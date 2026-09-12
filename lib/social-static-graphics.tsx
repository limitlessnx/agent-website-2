import { ImageResponse } from "next/og";
import { getSocialBrand } from "@/lib/social";
import { uploadSocialAsset } from "@/lib/social-assets";
import { requireTenant } from "@/lib/tenant";

const WIDTH = 1080;
const HEIGHT = 1350;

function clampText(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function renderGraphic(input: {
  brandName: string;
  hook: string;
  eyebrow?: string;
  footer?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 72px 62px",
          background:
            "radial-gradient(circle at 82% 12%, rgba(124,58,237,0.38), transparent 34%), radial-gradient(circle at 20% 76%, rgba(76,29,149,0.24), transparent 42%), linear-gradient(145deg,#050507 0%,#0b0b12 55%,#050507 100%)",
          color: "white",
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.08,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", gap: 2, alignItems: "baseline", fontSize: 28, letterSpacing: "0.16em", fontWeight: 800 }}>
            <span>FLU</span>
            <span style={{ color: "#8b5cf6" }}>X</span>
            <span>KNIGHT</span>
          </div>
          <div style={{ fontSize: 18, color: "#a1a1aa", letterSpacing: "0.08em" }}>AI BUSINESS SYSTEMS</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative", maxWidth: 900 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              border: "1px solid rgba(139,92,246,.42)",
              background: "rgba(139,92,246,.08)",
              borderRadius: 999,
              padding: "10px 18px",
              color: "#c4b5fd",
              fontSize: 22,
              letterSpacing: "0.04em",
            }}
          >
            {clampText(input.eyebrow || "SMARTER OPERATIONS", 42)}
          </div>
          <div style={{ fontSize: 86, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.045em" }}>
            {clampText(input.hook, 140)}
          </div>
          <div style={{ width: 150, height: 8, borderRadius: 99, background: "linear-gradient(90deg,#8b5cf6,#c084fc)" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative" }}>
          <div style={{ fontSize: 22, color: "#d4d4d8", maxWidth: 620, lineHeight: 1.35 }}>
            {clampText(input.footer || "Systems that follow up, support customers and move work forward.", 110)}
          </div>
          <div style={{ fontSize: 21, color: "#a78bfa", fontWeight: 700 }}>{input.brandName}.space</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}

export async function generateStaticGraphicForPost(postId: string) {
  const { supabase, organizationId } = await requireTenant();
  const brand = await getSocialBrand();
  if (!brand) throw new Error("A Social Brand is required before generating graphics.");

  const { data: post, error } = await supabase
    .from("social_posts")
    .select("id,brand_id,title,caption,format,content,metadata")
    .eq("organization_id", organizationId)
    .eq("id", postId)
    .single();
  if (error) throw error;

  const content = (post.content || {}) as Record<string, unknown>;
  const metadata = (post.metadata || {}) as Record<string, unknown>;
  const hook = String(content.hook || metadata.hook || post.title || "Build a smarter operating system.");
  const pillar = String(content.pillar || metadata.pillar || "AI automation");
  const objective = String(content.objective || metadata.objective || post.caption || "Smarter operations with Fluxknight.");

  const response = renderGraphic({
    brandName: brand.name,
    hook,
    eyebrow: pillar,
    footer: objective,
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  const asset = await uploadSocialAsset({
    postId: post.id,
    brandId: post.brand_id,
    assetType: "image",
    source: "system",
    fileName: `fluxknight-static-${post.id}.png`,
    mimeType: "image/png",
    body: bytes,
    sizeBytes: bytes.byteLength,
    width: WIDTH,
    height: HEIGHT,
    metadata: {
      renderer: "next-image-response-v1",
      template: "fluxknight-social-static-v1",
      generated_from: { hook, pillar, objective },
      storage_policy: "supabase-only",
    },
  });

  const existingAssetIds = Array.isArray(metadata.media_assets) ? metadata.media_assets : [];
  const { error: updateError } = await supabase
    .from("social_posts")
    .update({
      metadata: {
        ...metadata,
        media_assets: [...existingAssetIds, asset.id],
        primary_asset_id: asset.id,
        static_graphic_template: "fluxknight-social-static-v1",
      },
    })
    .eq("organization_id", organizationId)
    .eq("id", post.id);
  if (updateError) throw updateError;

  return asset;
}
