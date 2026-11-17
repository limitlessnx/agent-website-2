# Limitless Realty Maia: WhatsApp voice-only ElevenLabs cutover

## Confirmed production state (2026-11-17)

- Limitless Realty Meta Cloud API integration is connected. Fluxknight owns text messages, campaigns, consent, CRM, follow-ups and human handoffs.
- Current `app/api/whatsapp/webhook/route.ts` handles Meta Calling webhook events and `lib/maia-whatsapp-calling.ts` provides the incumbent **OpenAI Realtime** WebRTC offer/answer. It is **not** an ElevenLabs voice route.
- Existing ElevenLabs Maia: `agent_3001m7mgjzdff0e80qtetmfqdenx`. Production simulation `suite_9801m7nvg3sxfggv37j4s4b7b2xh` passed authenticated property search against Fluxknight.
- ElevenLabs workspace has no known Limitless Realty WhatsApp or SIP number configured. The existing Twilio number is a separate phone-number connection.

## Supported connection strategy

1. Do **not** use ElevenLabs native WhatsApp account import for the existing developer-app WABA: standard import does not support developer-app-created WABAs.
2. Meta Cloud API supports **SIP signaling for WhatsApp Calling** (independent from WhatsApp messaging). Its SIP switch replaces the calling Graph API/webhook signaling path for that number, so the existing OpenAI WhatsApp caller does not receive calls once SIP is enabled.
3. ElevenLabs supports inbound SIP into a registered SIP phone-number destination. The configuration must match a verified Meta TLS SIP ingress, authentication requirements and supported audio codecs.
4. **Do not assume direct Meta-to-ElevenLabs interop until verified**: Meta SIP implementations may offer WebRTC/OPUS/DTLS-SRTP; ElevenLabs SIP supports G.711/G.722 and TLS/SRTP. A gateway/SBC may be required to transcode or adapt signaling/media. Validate this before importing the live number.
5. Configure a nonproduction pilot endpoint (or isolated number) first and verify caller metadata, duplex audio and hangup behavior. Only after success configure the live Meta phone's SIP hostname and port.

## Read-only preflight

Super Admin: `GET /api/admin/integrations/maia-sip-preflight`

The endpoint reads Meta Cloud API `/{PHONE_NUMBER_ID}/settings?fields=calling` using tenant Vault credentials and returns **only sanitized calling and SIP readiness flags**. It never includes the Meta access token, SIP password, customer information or a raw Meta settings payload. No POST/enable endpoint exists by design.

## Cutover gates (all mandatory)

- [ ] Confirm active Meta app is Live and owns the phone-number calling settings.
- [ ] Check read-only Meta calling/SIP status and verify neither messaging routing nor active voice transport is accidentally changed.
- [ ] Provision approved SIP endpoint in ElevenLabs and validate codec, TLS cert, SRTP, SIP digest auth, call-id and caller-id mapping. If direct media codecs differ, use a tested SBC.
- [ ] Test two-way spoken greeting, customer recognition, property search, call duration >60 seconds, clean termination and worker/tool error handling.
- [ ] Keep WhatsApp messages, CRM, booking approvals and notifications in Fluxknight; do not enable ElevenLabs messaging.
- [ ] Record rollback Meta SIP status and prior server configuration (without secrets), preserve previous calling route and test rollback procedure.
- [ ] Use a deliberate, permissioned change to Meta SIP settings after a maintenance window and a green end-to-end test. This read-only preflight does not make that change.
- [ ] Route call identity to tenant-scoped CRM only after a verified caller identity is available.

## Sources

- https://elevenlabs.io/docs/eleven-agents/whatsapp
- https://elevenlabs.io/docs/eleven-agents/whatsapp/troubleshooting
- https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking
- https://developers.facebook.com/documentation/business-messaging/whatsapp/calling
- https://www.3cx.com/docs/whatsapp-sip-calling-integration/
