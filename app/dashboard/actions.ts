"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { createLead, createProperty } from "@/lib/limitless-data";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard");
}

export async function createLeadAction(formData: FormData) {
  await requireAdmin();
  await createLead({
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    status: String(formData.get("status") || "new"),
    score: String(formData.get("score") || "unscored"),
    budget: String(formData.get("budget") || ""),
    location_preference: String(formData.get("location_preference") || ""),
    property_type: String(formData.get("property_type") || ""),
    purpose: String(formData.get("purpose") || ""),
  });
  revalidatePath("/dashboard/limitless/leads");
}

export async function createPropertyAction(formData: FormData) {
  await requireAdmin();
  await createProperty({
    title: String(formData.get("title") || ""),
    location_area: String(formData.get("location_area") || ""),
    location_city: String(formData.get("location_city") || ""),
    price: String(formData.get("price") || ""),
    type: String(formData.get("type") || ""),
    status: String(formData.get("status") || "active"),
    drive_photos_link: String(formData.get("drive_photos_link") || ""),
    drive_brochure_link: String(formData.get("drive_brochure_link") || ""),
    features: String(formData.get("features") || ""),
    description: String(formData.get("description") || ""),
  });
  revalidatePath("/dashboard/limitless/properties");
  revalidatePath("/dashboard/limitless/media");
}
