import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { getServerSupabaseConfig } from "@/lib/supabase-server-rest";
import { SOCIAL_ASSET_BUCKET } from "@/lib/social-assets";
import { createMusicTicket, verifyMusicTicket, validateMusicInput, isAudioSignature } from "@/lib/social-music-upload";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Open this form in Flux Social before uploading." }, { status: 403 });
  const { supabase, organizationId } = await requireTenant();
  const { key } = getServerSupabaseConfig();
  if (!key) return NextResponse.json({ error: "Audio upload is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  try {
    if (body.phase === "prepare") {
      validateMusicInput({ size: body.size, mimeType: body.mimeType, licensed: body.licensed === true });
      const { data: brand, error } = await supabase.from("social_brands").select("id")
        .eq("organization_id", organizationId).eq("id", String(body.brandId)).single();
      if (error || !brand) throw new Error("Select a brand belonging to this workspace.");
      const { ticket, receipt } = createMusicTicket({ organizationId, brandId: brand.id,
        fileName: String(body.fileName).slice(0, 180), mimeType: body.mimeType, size: body.size, makeDefault: body.makeDefault === true }, key);
      const { data, error: signError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).createSignedUploadUrl(ticket.path);
      if (signError) throw new Error("Could not start the audio upload. Please try again.");
      return NextResponse.json({ uploadUrl: data.signedUrl, receipt });
    }
    if (body.phase !== "complete") throw new Error("Invalid upload request.");
    const ticket = verifyMusicTicket(String(body.receipt || ""), key, organizationId);
    const { data: brand, error: brandError } = await supabase.from("social_brands").select("id,metadata")
      .eq("organization_id", organizationId).eq("id", ticket.brandId).single();
    if (brandError || !brand) throw new Error("The selected brand is no longer available.");
    const { data: signed, error: signError } = await supabase.storage.from(SOCIAL_ASSET_BUCKET).createSignedUrl(ticket.path, 60);
    if (signError) throw new Error("Uploaded audio is not available. Please try again.");
    const response = await fetch(signed.signedUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Uploaded audio could not be verified.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== ticket.size || !isAudioSignature(bytes, ticket.mimeType)) {
      await supabase.storage.from(SOCIAL_ASSET_BUCKET).remove([ticket.path]);
      throw new Error("The uploaded file is not a valid MP3, WAV or M4A file.");
    }
    // Completing the same signed upload twice returns its existing asset.
    const { data: existing } = await supabase.from("social_assets").select("id")
      .eq("organization_id", organizationId).eq("brand_id", ticket.brandId).eq("storage_path", ticket.path).maybeSingle();
    let assetId = existing?.id;
    if (!assetId) {
      const { data: asset, error } = await supabase.from("social_assets").insert({
        organization_id: organizationId, brand_id: ticket.brandId, post_id: null, asset_type: "audio", source: "upload", status: "ready",
        bucket_id: SOCIAL_ASSET_BUCKET, storage_path: ticket.path, mime_type: ticket.mimeType, size_bytes: bytes.length,
        metadata: { purpose: "reel_background_music", original_file_name: ticket.fileName, licensed_for_social_usage: true,
          license_attested_at: new Date().toISOString(), uploaded_from: "social_asset_library" },
      }).select("id").single();
      if (error) throw new Error("Could not save the uploaded track. Please retry to finish saving it.");
      assetId = asset.id;
    }
    if (ticket.makeDefault) {
      const { error } = await supabase.from("social_brands").update({ metadata: {
        ...brand.metadata, default_reel_music_asset_id: assetId,
      } }).eq("organization_id", organizationId).eq("id", ticket.brandId);
      if (error) throw new Error("The track was saved, but its default setting could not be saved. Please retry.");
    }
    return NextResponse.json({ assetId, defaultForBrand: ticket.makeDefault });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Audio upload could not be completed." }, { status: 400 });
  }
}
