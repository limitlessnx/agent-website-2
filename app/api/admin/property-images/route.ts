import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadPublicMedia } from "@/lib/supabase-media";
import { updatePropertyImageLink } from "@/lib/limitless-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const formData = await request.formData();
    const propertyId = String(formData.get("property_id") || "");
    const propertyMedia = formData.get("property_media");

    if (!propertyId) return NextResponse.json({ error: "Property ID is missing." }, { status: 400 });
    if (!(propertyMedia instanceof File) || propertyMedia.size === 0) {
      return NextResponse.json({ error: "Choose an image or video first." }, { status: 400 });
    }

    const uploaded = await uploadPublicMedia(propertyMedia, {
      organizationKey: "limitless-realty",
      propertyId,
      channel: "whatsapp",
    });

    const property = uploaded.mediaType === "image" ? await updatePropertyImageLink(propertyId, uploaded.url) : null;

    return NextResponse.json({
      ok: true,
      ...uploaded,
      property,
      message: uploaded.mediaType === "image" ? "Image uploaded and linked to the property." : "Video uploaded and registered to the property.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Property media upload failed.";
    console.error("Property media upload failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
