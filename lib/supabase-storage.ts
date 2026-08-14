import { randomUUID } from "crypto";

const DEFAULT_BUCKET = "limitless-public-media";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function supabaseConfig() {
  const url = (
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";
  return { url, key };
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "bin";
}

function validateImage(file: File) {
  if (!file || file.size <= 0) throw new Error("Choose at least one property image.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}. Use JPG, PNG, WebP or GIF.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image ${file.name || "file"} is larger than the 10 MB limit.`);
  }
}

export function isSupabaseStorageConfigured() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

export async function uploadPublicImage(file: File, folder = "properties") {
  validateImage(file);
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("Supabase Storage is not configured on the server.");

  const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extensionFor(file)}`;
  const response = await fetch(`${url}/storage/v1/object/${DEFAULT_BUCKET}/${encodePath(path)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": file.type,
      "x-upsert": "true",
      "cache-control": "31536000",
    },
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase image upload failed (${response.status}). ${detail}`.trim());
  }

  return {
    bucket: DEFAULT_BUCKET,
    path,
    url: `${url}/storage/v1/object/public/${DEFAULT_BUCKET}/${encodePath(path)}`,
    mimeType: file.type,
    fileName: file.name,
    size: file.size,
  };
}

export async function uploadPublicImages(files: File[], folder = "properties") {
  const validFiles = files.filter((file) => file instanceof File && file.size > 0);
  if (!validFiles.length) throw new Error("Choose at least one property image.");

  const uploads = [];
  for (const file of validFiles) {
    uploads.push(await uploadPublicImage(file, folder));
  }
  return uploads;
}

export async function updatePropertyImages(propertyId: string, imageUrls: string[], coverImageUrl = "") {
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error("Supabase is not configured on the server.");
  if (!propertyId) throw new Error("Property ID is required to save images.");

  const response = await fetch(`${url}/rest/v1/properties?id=eq.${encodeURIComponent(propertyId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      image_urls: imageUrls,
      cover_image_url: coverImageUrl || imageUrls[0] || null,
      drive_photos_link: coverImageUrl || imageUrls[0] || null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase property image record update failed (${response.status}). ${detail}`.trim());
  }
}
