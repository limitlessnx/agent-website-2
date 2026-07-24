import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadSinglePropertyImageToDrive } from "@/lib/google-drive";
import { updatePropertyImageLink } from "@/lib/limitless-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const formData = await request.formData();
    const propertyId = String(formData.get("property_id") || "");
    const propertyTitle = String(formData.get("property_title") || "Property");
    const folderId = String(formData.get("folder_id") || "") || undefined;
    const file = formData.get("property_image");

    if (!propertyId) return NextResponse.json({ error: "Property ID is missing." }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    if (file.size > 3_500_000) return NextResponse.json({ error: "Image is still too large after compression." }, { status: 413 });

    const uploaded = await uploadSinglePropertyImageToDrive(propertyTitle, file, folderId);
    await updatePropertyImageLink(propertyId, uploaded.folderLink);

    return NextResponse.json({ ok: true, ...uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed.";
    console.error("Property image upload failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
