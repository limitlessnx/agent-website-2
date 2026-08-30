import { NextRequest, NextResponse } from "next/server";
import { createProperty, getProperties } from "@/lib/limitless-data";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { updatePropertyImages, uploadPublicImages } from "@/lib/supabase-storage";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const properties = await getProperties();
  return NextResponse.json({ properties });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  if (!session && !apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: Record<string, unknown>;
    let files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      files = formData
        .getAll("property_images")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0);
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

    if (!String(payload.title || "").trim()) {
      return NextResponse.json({ error: "Property title is required." }, { status: 400 });
    }

    const created = await createProperty(payload);
    const property = created[0];
    if (!property?.id) {
      return NextResponse.json({ error: "Property record was not created." }, { status: 502 });
    }

    if (files.length) {
      const uploads = await uploadPublicImages([files[0]], `properties/${property.id}`);
      await updatePropertyImages(property.id, [uploads[0].url], uploads[0].url);
      property.drive_photos_link = uploads[0].url;
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    console.error("Limitless property create failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Property could not be saved." },
      { status: 500 },
    );
  }
}
