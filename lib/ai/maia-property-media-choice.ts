/** Resolve media choice from customer text and the preceding assistant offer, never tool arguments. */
export function propertyMediaChoice(message: string, previousOffer = ""): string[] {
  const value = message.trim().toLowerCase();
  if (/\b(no|not|don't|do not|later|stop)\b/.test(value)) return [];
  const types = (source: string) => [
    /\b(images?|photos?|pictures?|flyers?)\b/.test(source) ? "image" : "",
    /\b(videos?|clips?)\b/.test(source) ? "video" : "",
    /\b(brochures?|documents?|pdfs?)\b/.test(source) ? "document" : "",
  ].filter(Boolean);
  const explicit = types(value);
  if (explicit.length && (/\b(send|show|share|see|watch)\b/.test(value) || /^(images?|photos?|pictures?|videos?|clips?|flyers?|brochures?|documents?|pdfs?)( please)?[.!?]?$/.test(value))) return explicit;
  if (!/^(yes|yes please|sure|okay|ok|please do|go ahead)[.!]?$/.test(value)) return [];
  const offered = types(previousOffer.toLowerCase());
  const isOffer = /\b(would you like|do you (?:want|wish)|shall i|can i)\b/i.test(previousOffer);
  return isOffer && offered.length === 1 ? offered : [];
}
