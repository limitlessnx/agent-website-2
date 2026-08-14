import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadPublicImage } from "@/lib/supabase-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") || formData.get("media");
    const channel = String(formData.get("channel") || "whatsapp").toLowerCase();
    const propertyId = String(formData.get("property_id") || "").trim() || undefined;
    const caption = String(formData.get("caption") || "").trim() || undefined;
    const whatsappPhone = String(formData.get("whatsapp_phone") || "").trim() || undefined;
    const telegramChatId = String(formData.get("telegram_chat_id") || "").trim() || undefined;

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image first." }, { status: 400 });
    }
    if (channel !== "whatsapp" && channel !== "telegram") {
      return NextResponse.json({ error: "Unsupported media channel." }, { status: 400 });
    }

    const uploaded = await uploadPublicImage(file, {
      organizationKey: "limitless-realty",
      propertyId,
      channel,
      caption,
      whatsappPhone,
      telegramChatId,
    });

    return NextResponse.json({ ok: true, ...uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media upload failed.";
    console.error("Admin media upload failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
