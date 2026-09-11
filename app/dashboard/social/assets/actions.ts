"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SOCIAL_ASSET_TYPES, uploadSocialAsset, type SocialAssetType } from "@/lib/social-assets";

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
