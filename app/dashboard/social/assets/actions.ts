"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SOCIAL_ASSET_TYPES, uploadSocialAsset, type SocialAssetType } from "@/lib/social-assets";
import { getSocialBrand } from "@/lib/social";
import { upsertPrimaryLogoRegistry } from "@/lib/social-brand-assets";

const MAX_SOCIAL_ASSET_BYTES = 50 * 1024 * 1024;

export async function uploadSocialAssetAction(formData: FormData) {
  const file = formData.get("file");
  const postId = String(formData.get("post_id") || "").trim() || null;
  const assetType = String(formData.get("asset_type") || "other") as SocialAssetType;

  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
  if (!SOCIAL_ASSET_TYPES.includes(assetType)) throw new Error("Invalid social asset type.");
  if (file.size > MAX_SOCIAL_ASSET_BYTES) throw new Error("Social assets are limited to 50 MB in the current Supabase bucket.");

  await uploadSocialAsset({
    postId,
    assetType,
    source: "upload",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    body: file,
    sizeBytes: file.size,
    metadata: { uploaded_from: "social_asset_library" },
  });

  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/assets");
  revalidatePath("/dashboard/social/posts");
  redirect("/dashboard/social/assets?uploaded=1");
}

/**
 * Upload and register the active organization's canonical social logo.
 * The previous asset is intentionally retained for rollback.
 */
export async function uploadPrimarySocialLogoAction(formData: FormData) {
  const brand = await getSocialBrand();
  if (!brand) throw new Error("Configure your social brand before uploading its logo.");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a PNG logo.");
  if (file.type !== "image/png") throw new Error("The primary logo must be a PNG image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Primary logos must be smaller than 5 MB.");

  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (signature.length !== 8 || signature.some((byte, index) => byte !== pngSignature[index])) {
    throw new Error("This file does not contain a valid PNG signature.");
  }

  const asset = await uploadSocialAsset({
    brandId: brand.id,
    assetType: "image",
    source: "upload",
    fileName: file.name,
    mimeType: "image/png",
    body: file,
    sizeBytes: file.size,
    metadata: { uploaded_from: "social_primary_logo", canonical_logo_candidate: true },
  });

  await upsertPrimaryLogoRegistry({
    brandId: brand.id,
    socialAssetId: asset.id,
    name: `${brand.name} canonical primary logo`,
    variant: "transparent",
  });

  revalidatePath("/dashboard/social/assets");
  revalidatePath("/dashboard/social/brand");
  revalidatePath("/dashboard/social/review");
  redirect("/dashboard/social/assets?logo_updated=1");
}

/** Uploaded music is not eligible for Reels without an explicit rights attestation. */
export async function uploadLicensedReelMusicAction(formData: FormData) {
  const brand = await getSocialBrand();
  if (!brand) throw new Error("Configure the social brand first.");
  if (formData.get("licensed_for_social_usage") !== "yes") {
    throw new Error("You must confirm that you have the right to use this music in published social videos.");
  }
  const file = formData.get("music");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a music file.");
  if (!["audio/mpeg", "audio/wav", "audio/mp4"].includes(file.type)) {
    throw new Error("Use an MP3, WAV or M4A audio file.");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("Music tracks must be 20 MB or smaller.");
  await uploadSocialAsset({
    brandId: brand.id,
    assetType: "audio",
    source: "upload",
    fileName: file.name,
    mimeType: file.type,
    body: file,
    sizeBytes: file.size,
    metadata: {
      purpose: "reel_background_music",
      licensed_for_social_usage: true,
      license_attested_at: new Date().toISOString(),
      uploaded_from: "social_asset_library",
    },
  });
  revalidatePath("/dashboard/social/assets");
  revalidatePath("/dashboard/social/review");
  redirect("/dashboard/social/assets?music_uploaded=1");
}
