import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadPublicImage } from "@/lib/supabase-media";
import { updatePropertyImageLink } from "@/lib/limitless-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const formData = await request.formData();
    const propertyId = String(formData.get("property_id") || "");
    const propertyImage = formData.get("property_image");

    if (!propertyId) return NextResponse.json({ error: "Property ID is missing." }, { status: 400 });
    if (!(propertyImage instanceof File) || propertyImage.size === 0) {
      return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
    }

    const uploaded = await uploadPublicImage(propertyImage, {
      organizationKey: "limitless-realty",
      propertyId,
      channel: "whatsapp",
    });

    const property = await updatePropertyImageLink(propertyId, uploaded.url);

    return NextResponse.json({
      ok: true,
      ...uploaded,
      property,
      message: "Image uploaded to Supabase Storage and linked to the property.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed.";
    console.error("Property image upload failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
