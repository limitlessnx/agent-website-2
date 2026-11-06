# Maia WhatsApp Calling transport

The Maia voice-call transport uses Meta WhatsApp Business Calling for signaling and OpenAI Realtime for speech-to-speech audio.

Meta sends a WhatsApp `calls` webhook containing the caller, call ID, direction, and a WebRTC SDP offer. The application sends that offer to OpenAI Realtime at `POST /v1/realtime/calls`, receives an SDP answer, and submits the answer to Meta at `POST /{PHONE_NUMBER_ID}/calls` with `action: "accept"`. This allows Meta WhatsApp and OpenAI Realtime to negotiate the audio session directly without ElevenLabs or a separate RTP relay.

The implementation is feature-flagged with `MAIA_WHATSAPP_CALLING_ENABLED=false` by default. Enabling it requires Meta Calling to be enabled for the tenant’s Cloud API phone number, the app to subscribe to the `calls` webhook field, and the number to be using Cloud API rather than the WhatsApp Business app. The Meta call-answer window is approximately 30–60 seconds, so the SDP handshake runs synchronously in the webhook route rather than through Trigger.dev.

The current slice configures Maia-scoped voice instructions, OpenAI Realtime audio settings, tenant credential lookup, charge preflight, and Meta call acceptance. A Trigger.dev sideband task now attaches to the returned OpenAI realtime session and exposes read-only `search_estates`, `get_estate_knowledge`, `search_properties`, and `get_property_media` tools with the Limitless Realty organization scope. Media delivery and CRM mutations remain intentionally unavailable during the call because the existing delivery tools require a verified WhatsApp chat session and their existing approval controls.

Sources:

- [Meta Cloud API Calling](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling)
- [Meta Cloud API Calling reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/reference)
- [OpenAI Realtime API](https://developers.openai.com/api/docs/guides/realtime)
- [OpenAI voice server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls)
