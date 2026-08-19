import type { PropertyRecord } from "@/lib/limitless-data";

const TEMPLATE_BODY_LIMIT = 1024;

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function preserveMessage(value: unknown) {
  return String(value || "").trim();
}

function shorten(value: string, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, Math.max(0, max - 1));
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf(", "), clipped.lastIndexOf(" "));
  return `${(boundary > max * 0.6 ? clipped.slice(0, boundary) : clipped).trim()}…`;
}

export class PropertyCampaignMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyCampaignMessageError";
  }
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

function joinBlocks(blocks: string[]) {
  return blocks.filter(Boolean).join("\n\n");
}

export function buildPropertyCampaignContent(
  property: PropertyRecord,
  customMessage = "",
  mediaUrl = "",
): PropertyCampaignContent {
  const propertyName = clean(property.title) || "this property";
  const location = [clean(property.location_area), clean(property.location_city)].filter(Boolean).join(", ");
  const imageUrl = clean(mediaUrl || property.drive_photos_link);
  const personalMessage = preserveMessage(customMessage);
  const replyInstruction = `Reply “More details on ${propertyName}” and Agent Maia will continue with this exact property.`;

  // An explicitly written campaign is immutable. Property context, links and
  // reply instructions are stored as structured metadata instead of being
  // appended to the customer's approved message.
  if (personalMessage) {
    return {
      message: personalMessage,
      propertyName,
      imageUrl,
      replyInstruction,
      memory: {
        property_id: property.id,
        property_name: propertyName,
        property_names: [propertyName],
        image_url: imageUrl,
        message: personalMessage,
        reply_instruction: replyInstruction,
      },
    };
  }

  const requiredGeneratedLines = [
    `🏡 ${propertyName}`,
    imageUrl ? `View property image: ${imageUrl}` : "",
  ].filter(Boolean);

  const minimumMessage = joinBlocks([
    requiredGeneratedLines.join("\n"),
    replyInstruction,
  ]);

  if (minimumMessage.length > TEMPLATE_BODY_LIMIT) {
    throw new PropertyCampaignMessageError(
      `The generated property campaign for ${propertyName} exceeds the supported template message length.`,
    );
  }

  const optionalLines = [
    location ? `📍 ${location}` : "",
    clean(property.price) ? `💰 ${clean(property.price)}` : "",
    clean(property.type) ? `Type: ${clean(property.type)}` : "",
    clean(property.features) ? `Key details: ${clean(property.features)}` : "",
    clean(property.description) ? clean(property.description) : "",
  ].filter(Boolean);

  const generatedLines = [...requiredGeneratedLines];

  for (const line of optionalLines) {
    const candidate = joinBlocks([
      generatedLines.join("\n"),
      line,
      replyInstruction,
    ]);

    if (candidate.length <= TEMPLATE_BODY_LIMIT) {
      generatedLines.push(line);
      continue;
    }

    const currentMessage = joinBlocks([
      generatedLines.join("\n"),
      replyInstruction,
    ]);
    const remaining = TEMPLATE_BODY_LIMIT - currentMessage.length - 1;
    if (remaining >= 50) generatedLines.push(shorten(line, remaining));
    break;
  }

  const message = joinBlocks([
    generatedLines.join("\n"),
    replyInstruction,
  ]);

  return {
    message,
    propertyName,
    imageUrl,
    replyInstruction,
    memory: {
      property_id: property.id,
      property_name: propertyName,
      property_names: [propertyName],
      image_url: imageUrl,
      message,
      reply_instruction: replyInstruction,
    },
  };
}
