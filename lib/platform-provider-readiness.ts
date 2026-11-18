/** Presence only: never calls a provider, tests credentials, or returns their values. */
export function getPlatformProviderReadiness(env: NodeJS.ProcessEnv = process.env) {
  const any = (...keys: string[]) => keys.some(key => Boolean(env[key]?.trim()));
  return [
    { name: "WhatsApp / Meta", configured: any("WHATSAPP_ACCESS_TOKEN", "META_WHATSAPP_ACCESS_TOKEN") && any("WHATSAPP_PHONE_NUMBER_ID", "META_WHATSAPP_PHONE_NUMBER_ID"), href: "/dashboard/settings" },
    { name: "ElevenLabs", configured: any("ELEVENLABS_API_KEY"), href: "/dashboard/settings" },
    { name: "Transactional email", configured: any("FLUXKNIGHT_RESEND_API_KEY", "RESEND_API_KEY"), href: "/dashboard/email" },
    { name: "Google Calendar OAuth", configured: any("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID") && any("GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET"), href: "/dashboard/settings" },
    { name: "Trigger.dev", configured: any("TRIGGER_SECRET_KEY"), href: "/dashboard/workflows" },
    { name: "n8n", configured: any("N8N_BASE_URL") && any("N8N_API_KEY"), href: "/dashboard/workflows" },
  ];
}
