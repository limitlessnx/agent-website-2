import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const PUBLIC_MEDIA_BUCKET = "limitless-public-media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type MediaUploadOptions = {
  organizationKey?: string;
  propertyId?: string;
  channel?: "whatsapp" | "telegram";
  caption?: string;
  whatsappPhone?: string;
  telegramChatId?: string;
};

function getConfig() {
  const url =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  if (!url || !key) throw new Error("Supabase server storage is not configured.");
  return { url, key };
}

function adminClient(): SupabaseClient {
  const { url, key } = getConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeSegment(value: string | undefined, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export function getPublicMediaUrl(path: string) {
  const { url } = getConfig();
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export async function uploadPublicImage(file: File, options: MediaUploadOptions = {}) {
  if (!(file instanceof File) || file.size <= 0) throw new Error("Choose an image to upload.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG, WebP and GIF images are supported.");
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be 10MB or smaller.");

  const supabase = adminClient();
  const organization = safeSegment(options.organizationKey, "limitless-realty");
  const channel = safeSegment(options.channel, "whatsapp");
  const property = options.propertyId ? safeSegment(options.propertyId, "property") : "general";
  const extension = extensionForMime(file.type);
  const path = `${organization}/${channel}/${property}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_MEDIA_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) throw new Error(`Supabase image upload failed: ${uploadError.message}`);

  const url = getPublicMediaUrl(path);
  let mediaAssetId: string | undefined;

  if (options.channel) {
    const { data, error } = await supabase
      .from("media_assets")
      .insert({
        channel: options.channel,
        direction: "outbound",
        storage_bucket: PUBLIC_MEDIA_BUCKET,
        storage_path: path,
        mime_type: file.type,
        file_name: file.name || path.split("/").pop(),
        caption: options.caption || null,
        whatsapp_phone: options.whatsappPhone || null,
        telegram_chat_id: options.telegramChatId || null,
        property_id: options.propertyId || null,
        send_status: "stored",
        metadata: { public_url: url, source: "fluxknight_dashboard" },
      })
      .select("id")
      .maybeSingle();

    if (error) throw new Error(`Supabase media record failed: ${error.message}`);
    mediaAssetId = data?.id;
  }

  return {
    bucket: PUBLIC_MEDIA_BUCKET,
    path,
    url,
    fileName: file.name || path.split("/").pop() || "image",
    mimeType: file.type,
    size: file.size,
    mediaAssetId,
  };
}
