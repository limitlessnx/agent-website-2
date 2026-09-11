import { requireTenant } from "@/lib/tenant";

export const SOCIAL_ASSET_BUCKET = "flux-social-assets";

export const SOCIAL_ASSET_TYPES = [
  "image",
  "carousel_slide",
  "video",
  "reel",
  "audio",
  "thumbnail",
  "screenshot",
  "other",
] as const;

export type SocialAssetType = (typeof SOCIAL_ASSET_TYPES)[number];
export type SocialAssetSource = "upload" | "openai" | "remotion" | "elevenlabs" | "system" | "external";
export type SocialAssetStatus = "pending" | "generating" | "ready" | "failed" | "archived";

export type SocialAsset = {
  id: string;
  organization_id: string;
  post_id: string | null;
  brand_id: string | null;
  asset_type: SocialAssetType;
  source: SocialAssetSource;
  status: SocialAssetStatus;
  bucket_id: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  provider_asset_id: string | null;
  checksum: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function safeFileName(value: string) {
  const base = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "asset";
}

function buildStoragePath(organizationId: string, postId: string | null, fileName: string) {
  const scope = postId || "unassigned";
  const id = crypto.randomUUID();
  return `${organizationId}/${scope}/${id}-${safeFileName(fileName)}`;
}

async function assertPostBelongsToTenant(postId: string | null) {
  if (!postId) return;
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_posts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Social post does not belong to the active organization.");
}

export async function listSocialAssets(postId?: string): Promise<SocialAsset[]> {
  const { supabase, organizationId } = await requireTenant();
  let query = supabase
    .from("social_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (postId) query = query.eq("post_id", postId);
  const { data, error } = await query.limit(250);
  if (error) throw error;
  return (data || []) as SocialAsset[];
}

export async function uploadSocialAsset(input: {
  postId?: string | null;
  brandId?: string | null;
  assetType: SocialAssetType;
  source?: SocialAssetSource;
  fileName: string;
  mimeType: string;
  body: Blob | ArrayBuffer | Uint8Array;
  sizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  providerAssetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, organizationId } = await requireTenant();
  const postId = input.postId || null;
  await assertPostBelongsToTenant(postId);

  if (input.brandId) {
    const { data: brand, error: brandError } = await supabase
      .from("social_brands")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", input.brandId)
      .maybeSingle();
    if (brandError) throw brandError;
    if (!brand) throw new Error("Social brand does not belong to the active organization.");
  }

  const storagePath = buildStoragePath(organizationId, postId, input.fileName);
  const { error: uploadError } = await supabase.storage
    .from(SOCIAL_ASSET_BUCKET)
    .upload(storagePath, input.body, {
      contentType: input.mimeType,
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from("social_assets")
    .insert({
      organization_id: organizationId,
      post_id: postId,
      brand_id: input.brandId || null,
      asset_type: input.assetType,
      source: input.source || "upload",
      status: "ready",
      bucket_id: SOCIAL_ASSET_BUCKET,
      storage_path: storagePath,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
      provider_asset_id: input.providerAssetId ?? null,
      metadata: input.metadata || {},
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([storagePath]);
    throw insertError;
  }

  return data as SocialAsset;
}

export async function createSocialAssetSignedUrl(assetId: string, expiresIn = 3600) {
  const { supabase, organizationId } = await requireTenant();
  const { data: asset, error } = await supabase
    .from("social_assets")
    .select("id,bucket_id,storage_path")
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .single();
  if (error) throw error;

  const { data, error: signedUrlError } = await supabase.storage
    .from(asset.bucket_id)
    .createSignedUrl(asset.storage_path, expiresIn);
  if (signedUrlError) throw signedUrlError;
  return data.signedUrl;
}

export async function deleteSocialAsset(assetId: string) {
  const { supabase, organizationId } = await requireTenant();
  const { data: asset, error } = await supabase
    .from("social_assets")
    .select("id,bucket_id,storage_path")
    .eq("organization_id", organizationId)
    .eq("id", assetId)
    .single();
  if (error) throw error;

  const { error: storageError } = await supabase.storage.from(asset.bucket_id).remove([asset.storage_path]);
  if (storageError) throw storageError;

  const { error: deleteError } = await supabase
    .from("social_assets")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", assetId);
  if (deleteError) throw deleteError;
}
