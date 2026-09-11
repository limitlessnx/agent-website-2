import { requireTenant } from "@/lib/tenant";
import { createSocialAssetSignedUrl } from "@/lib/social-assets";

export type SocialBrandAssetRole =
  | "logo_primary"
  | "logo_inverse"
  | "logo_mark"
  | "logo_wordmark"
  | "font_reference"
  | "color_reference"
  | "other";

export type SocialBrandAsset = {
  id: string;
  organization_id: string;
  brand_id: string;
  asset_role: SocialBrandAssetRole;
  social_asset_id: string | null;
  name: string;
  variant: string | null;
  usage_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listSocialBrandAssets(brandId?: string): Promise<SocialBrandAsset[]> {
  const { supabase, organizationId } = await requireTenant();
  let query = supabase
    .from("social_brand_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("asset_role", { ascending: true });

  if (brandId) query = query.eq("brand_id", brandId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SocialBrandAsset[];
}

export async function getPrimaryLogoAsset(brandId: string) {
  const { supabase, organizationId } = await requireTenant();
  const { data, error } = await supabase
    .from("social_brand_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("asset_role", "logo_primary")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const asset = data as SocialBrandAsset;
  const signedUrl = asset.social_asset_id
    ? await createSocialAssetSignedUrl(asset.social_asset_id, 3600)
    : null;

  return { ...asset, signed_url: signedUrl };
}

export async function upsertPrimaryLogoRegistry(input: {
  brandId: string;
  socialAssetId: string;
  name?: string;
  variant?: string;
}) {
  const { supabase, organizationId } = await requireTenant();

  const { data: brand, error: brandError } = await supabase
    .from("social_brands")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.brandId)
    .maybeSingle();
  if (brandError) throw brandError;
  if (!brand) throw new Error("Social brand does not belong to the active organization.");

  const { data: asset, error: assetError } = await supabase
    .from("social_assets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", input.socialAssetId)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset) throw new Error("Logo asset does not belong to the active organization.");

  const payload = {
    organization_id: organizationId,
    brand_id: input.brandId,
    asset_role: "logo_primary" as const,
    social_asset_id: input.socialAssetId,
    name: input.name || "Fluxknight canonical primary logo",
    variant: input.variant || "dark-background",
    is_active: true,
    usage_rules: {
      must_use_exact_asset: true,
      allow_ai_redraw: false,
      allow_recolor: false,
      allow_stretch: false,
      allow_crop: false,
      placement_presets: ["top_left", "top_right", "footer"],
      clear_space_ratio: 1,
      minimum_height_px: 32,
    },
    metadata: {
      canonical: true,
      renderer_policy: "composite-after-generation",
    },
  };

  const { data, error } = await supabase
    .from("social_brand_assets")
    .upsert(payload, { onConflict: "organization_id,brand_id,asset_role,name" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SocialBrandAsset;
}
