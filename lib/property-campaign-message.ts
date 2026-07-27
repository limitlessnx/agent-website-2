import type { PropertyRecord } from "@/lib/limitless-data";

const TEMPLATE_BODY_LIMIT = 1024;

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shorten(value: string, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, Math.max(0, max - 1));
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf(", "), clipped.lastIndexOf(" "));
  return `${(boundary > max * 0.6 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

export type PropertyCampaignContent = {
  message: string;
  propertyName: string;
  imageUrl: string;
  replyInstruction: string;
  memory: {
    property_id: string;
    property_name: string;
    property_names: string[];
    image_url: string;
    message: string;
    reply_instruction: string;
  };
};

export function buildPropertyCampaignContent(
  property: PropertyRecord,
  customMessage = "",
  mediaUrl = "",
): PropertyCampaignContent {
  const propertyName = clean(property.title) || "this property";
  const location = [clean(property.location_area), clean(property.location_city)].filter(Boolean).join(", ");
  const imageUrl = clean(mediaUrl || property.drive_photos_link);
  const replyInstruction = `Reply “More details on ${propertyName}” and Agent Maia will continue with this exact property.`;

  const facts = [
    propertyName ? `🏡 ${propertyName}` : "",
    location ? `📍 ${location}` : "",
    clean(property.price) ? `💰 ${clean(property.price)}` : "",
    clean(property.type) ? `Type: ${clean(property.type)}` : "",
    clean(property.features) ? `Key details: ${shorten(clean(property.features), 220)}` : "",
    clean(property.description) ? shorten(clean(property.description), 300) : "",
    imageUrl ? `View property image: ${imageUrl}` : "",
  ].filter(Boolean);

  const intro = clean(customMessage);
  const blocks = [intro, facts.join("\n"), replyInstruction].filter(Boolean);
  let message = blocks.join("\n\n");

  if (message.length > TEMPLATE_BODY_LIMIT) {
    const fixedLength = facts.slice(0, 4).join("\n").length + imageUrl.length + replyInstruction.length + 16;
    const descriptionBudget = Math.max(120, TEMPLATE_BODY_LIMIT - fixedLength);
    const compactFacts = [
      `🏡 ${propertyName}`,
      location ? `📍 ${location}` : "",
      clean(property.price) ? `💰 ${clean(property.price)}` : "",
      clean(property.type) ? `Type: ${clean(property.type)}` : "",
      clean(property.features) ? `Key details: ${shorten(clean(property.features), Math.min(220, descriptionBudget))}` : "",
      imageUrl ? `View property image: ${imageUrl}` : "",
    ].filter(Boolean);
    const introBudget = Math.max(0, TEMPLATE_BODY_LIMIT - compactFacts.join("\n").length - replyInstruction.length - 4);
    message = [introBudget > 40 ? shorten(intro, introBudget) : "", compactFacts.join("\n"), replyInstruction]
      .filter(Boolean)
      .join("\n\n");
  }

  return {
    message: message.slice(0, TEMPLATE_BODY_LIMIT),
    propertyName,
    imageUrl,
    replyInstruction,
    memory: {
      property_id: property.id,
      property_name: propertyName,
      property_names: [propertyName],
      image_url: imageUrl,
      message: message.slice(0, TEMPLATE_BODY_LIMIT),
      reply_instruction: replyInstruction,
    },
  };
}
