import type { ReelScene } from "@/lib/social-video-plan";

export const REEL_VISUAL_KINDS = ["inbox", "question_router", "answer", "capture", "handoff", "overview", "pipeline"] as const;
export type ReelVisual = { kind: typeof REEL_VISUAL_KINDS[number]; title: string; items: string[] };

/** Handle both literal \\n and double-escaped line breaks from older storyboards. */
export function normalizeReelText(text: string) {
  return text.replace(/\\+r\\+n|\\+n|\\+r/g, "\n").replace(/\r\n?/g, "\n").trim();
}

export function getReelVisual(scene: ReelScene): ReelVisual {
  if (scene.visual) {
    if (!REEL_VISUAL_KINDS.includes(scene.visual.kind) || !scene.visual.items.length) {
      throw new Error("Reel scene needs a supported visual with audience-facing labels.");
    }
    return { ...scene.visual, title: normalizeReelText(scene.visual.title),
      items: scene.visual.items.slice(0, 5).map(normalizeReelText) };
  }
  // Compatibility for the specific older support storyboard. Never display the
  // director's prose as copy or pretend arbitrary media instructions were met.
  const direction = scene.visual_direction.toLowerCase();
  if (/five.*enquiry cards|repeat questions|incoming enquiry/.test(direction)) {
    return { kind: "inbox", title: "Customer enquiries", items: ["Availability?", "Pricing?", "How do I book?", "Which documents?", "Opening hours?"] };
  }
  if (/two.*branches|defined question.*needs judg/.test(direction)) {
    return { kind: "question_router", title: "Customer enquiry", items: ["Defined question", "Needs judgment"] };
  }
  if (/approved answer|configured answer/.test(direction)) {
    return { kind: "answer", title: "Configured answers", items: ["Is the property available?", "What documents do I need?", "Business-approved information", "Which property are you interested in? I can help with its availability and document requirements."] };
  }
  if (/capture panel|fields populate/.test(direction)) {
    return { kind: "capture", title: "Enquiry details", items: ["Enquiry type", "Preferred date", "Customer name", "Contact details"] };
  }
  if (/human-assignee|request needs review/.test(direction)) {
    return { kind: "handoff", title: "Request needs review", items: ["Maia", "Support team", "Conversation context attached"] };
  }
  if (/complete workflow/.test(direction)) {
    return { kind: "overview", title: "One connected support flow", items: ["Enquiry", "Configured answer", "Capture details", "Human review"] };
  }
  throw new Error("This legacy storyboard needs structured visual data before rendering. Review its visual directions.");
}
