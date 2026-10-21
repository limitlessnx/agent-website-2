import { NextRequest, NextResponse } from "next/server";
import { getProperties } from "@/lib/limitless-data";
import { createPropertyNormalized } from "@/lib/limitless-property-write";
import { updatePropertyImageLink } from "@/lib/limitless-data";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { uploadPublicMedia } from "@/lib/supabase-media";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = await resolveAdminOrganizationScope();
  if (scope.kind !== "system" || scope.systemId !== "limitless-realty") {
    return NextResponse.json(
      { error: "Switch to the Limitless Realty workspace before accessing this catalog.", code: "wrong_organization_context" },
      { status: 403 },
    );
  }
  const properties = await getProperties(150, scope.organizationId);
  return NextResponse.json({ properties });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: Record<string, unknown>;
    let imageFiles: File[] = [];
    let videoFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const nonEmptyFiles = (key: string) => formData.getAll(key).filter((entry): entry is File => entry instanceof File && entry.size > 0);
      imageFiles = nonEmptyFiles("property_images");
      videoFiles = nonEmptyFiles("property_videos");
      // Backwards compatibility with older clients that used one shared field.
      const legacyFiles = nonEmptyFiles("property_media");
      imageFiles.push(...legacyFiles.filter(file => file.type.startsWith("image/")));
      videoFiles.push(...legacyFiles.filter(file => file.type.startsWith("video/")));
      payload = {
        title: value(formData, "title"),
        price: value(formData, "price"),
        location_area: value(formData, "location_area"),
        location_city: value(formData, "location_city"),
        type: value(formData, "type"),
        status: value(formData, "status") || "active",
        drive_brochure_link: value(formData, "drive_brochure_link"),
        features: value(formData, "features"),
        description: value(formData, "description"),
      };
    } else {
      payload = (await request.json()) as Record<string, unknown>;
    }

    const requiredFields = [
      ["title", "Property title"],
      ["price", "Price"],
      ["location_area", "Area/community"],
      ["location_city", "City/state"],
      ["type", "Type"],
      ["features", "Title/features"],
      ["description", "Brief/description"],
    ] as const;
    const missing = requiredFields.filter(([name]) => !String(payload[name] || "").trim()).map(([, label]) => label);
    if (missing.length) {
      return NextResponse.json(
        { error: `Please complete: ${missing.join(", ")}.`, code: "missing_property_fields", fields: missing },
        { status: 400 },
      );
    }

    const scope = await resolveAdminOrganizationScope();
    if (scope.kind !== "system" || scope.systemId !== "limitless-realty") {
      return NextResponse.json(
        { error: "Switch to the Limitless Realty workspace before saving a property.", code: "wrong_organization_context" },
        { status: 403 },
      );
    }
    const created = await createPropertyNormalized(payload, scope.organizationId);
    const property = created[0];
    if (!property?.id) return NextResponse.json({ error: "Property record was not created." }, { status: 502 });

    const uploads = [];
    for (const file of [...imageFiles, ...videoFiles]) {
      uploads.push(await uploadPublicMedia(file, {
        organizationKey: scope.slug || "limitless-realty",
        organizationId: scope.organizationId,
        propertyId: String(property.id),
        channel: "whatsapp",
      }));
    }
    const firstImage = uploads.find(item => item.mediaType === "image");
    if (firstImage) {
      await updatePropertyImageLink(String(property.id), firstImage.url, scope.organizationId);
      property.drive_photos_link = firstImage.url;
    }

    return NextResponse.json({
      property,
      media: uploads.map(({ url, fileName, mimeType, size, mediaType }) => ({ url, fileName, mimeType, size, mediaType })),
      message: uploads.length ? `Property saved with ${uploads.length} media file(s).` : "Property saved without media.",
    }, { status: 201 });
  } catch (error) {
    console.error("Limitless property create failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Property could not be saved." }, { status: 500 });
  }
}
