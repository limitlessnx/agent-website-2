/** Versioned, industry-neutral templates. These are drafts, not shared Meta approvals. */
export const CAMPAIGN_STARTER_VERSION = 1;
export const CAMPAIGN_STARTERS = [
  {
    name: "fluxknight_business_update_v1", language: "en", category: "MARKETING",
    purpose: "campaign", variable_keys: ["customer_name", "update_details"],
    body: "Hello {{1}}, we have a business update to share with you: {{2}}. Reply to this message if you would like more information. Thank you for staying connected with us.",
    examples: ["Ada", "Our new customer service hours are Monday to Saturday, 9 am to 6 pm"],
  },
  {
    name: "fluxknight_business_offer_v1", language: "en", category: "MARKETING",
    purpose: "campaign_promotion", variable_keys: ["customer_name", "offer_details"],
    body: "Hello {{1}}, we have a special offer for our customers: {{2}}. Reply to learn more about this offer and its availability. Thank you for choosing our business.",
    examples: ["Ada", "Enjoy 10% off selected services this weekend"],
  },
  {
    name: "fluxknight_guest_offer_v1", language: "en", category: "MARKETING",
    purpose: "hotel_campaign", variable_keys: ["customer_name", "offer_details"],
    body: "Hello {{1}}, we have a special offer for our guests: {{2}}. Reply to learn more about availability and booking. We look forward to welcoming you.",
    examples: ["Ada", "Enjoy a weekend stay with complimentary breakfast, subject to availability"],
  },
] as const;

export type CampaignStarter = typeof CAMPAIGN_STARTERS[number];
export function campaignStarters(hotel: boolean) {
  return CAMPAIGN_STARTERS.filter(item => hotel ? item.purpose === "hotel_campaign" : item.purpose !== "hotel_campaign");
}
export function starterMatches(starter: CampaignStarter, item: {name: string; language: string; category: string; body: string; components: Array<{type?: string; text?: string}>}) {
  return item.name === starter.name && item.language === starter.language && item.category === starter.category
    && item.body === starter.body && item.components.length === 1 && item.components[0].type === "BODY";
}
export function starterMetaPayload(starter: CampaignStarter) {
  return {name:starter.name,language:starter.language,category:starter.category,components:[{type:"BODY",text:starter.body,example:{body_text:[[...starter.examples]]}}]};
}
