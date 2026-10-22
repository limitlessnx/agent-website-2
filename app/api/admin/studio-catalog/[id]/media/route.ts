import { NextRequest, NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/supabase-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;

function extension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  return "jpg";
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await authorizeXposureTenantAccess("systems.manage");
  if (!access.ok) return access.response;
  const organizationId = access.organizationId;
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "Choose an image or video first." }, { status: 400 });
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) return NextResponse.json({ error: "Use JPG, PNG, WebP, MP4, WebM or MOV." }, { status: 415 });
  if (isImage && file.size > IMAGE_LIMIT) return NextResponse.json({ error: "Images must be 10 MB or smaller." }, { status: 413 });
  if (isVideo && file.size > VIDEO_LIMIT) return NextResponse.json({ error: "Videos must be 100 MB or smaller." }, { status: 413 });

  const admin = createAdminClient();
  const { data: item, error: readError } = await admin.from("studio_catalog_items").select("id,media_urls,cover_image_url")
    .eq("id", id).eq("organization_id", organizationId).maybeSingle();
  if (readError) return NextResponse.json({ error: "Catalogue item could not be verified." }, { status: 503 });
  if (!item) return NextResponse.json({ error: "Catalogue item not found in this Xposure workspace." }, { status: 404 });

  const path = `xposure/${organizationId}/catalogue/${id}/${crypto.randomUUID()}.${extension(file.type)}`;
  const { error: uploadError } = await admin.storage.from(PUBLIC_MEDIA_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return NextResponse.json({ error: "Media upload failed. Check the configured studio media bucket." }, { status: 502 });
  const url = admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  const existing = Array.isArray(item.media_urls) ? item.media_urls.filter((value: unknown): value is string => typeof value === "string") : [];
  const mediaUrls = [...new Set([...existing, url])];
  const update: Record<string, unknown> = { media_urls: mediaUrls, updated_at: new Date().toISOString() };
  if (isImage && !item.cover_image_url) update.cover_image_url = url;
  const { data: updated, error: updateError } = await admin.from("studio_catalog_items").update(update)
    .eq("id", id).eq("organization_id", organizationId).select("id,title,media_urls,cover_image_url").maybeSingle();
  if (updateError || !updated) {
    await admin.storage.from(PUBLIC_MEDIA_BUCKET).remove([path]);
    return NextResponse.json({ error: "Media could not be attached to this package. The upload was rolled back where possible." }, { status: 503 });
  }
  return NextResponse.json({ item: updated, media: { url, path, mimeType: file.type, size: file.size, type: isImage ? "image" : "video" } }, { status: 201 });
}
