# Maia WhatsApp voice pilot

This service answers the existing Meta WebRTC offer using aiortc. It negotiates
Opus on the Meta leg and sends 16 kHz mono PCM to the existing Maia pilot over
an authenticated ElevenLabs Agent WebSocket. It returns Maia's audio over the
same WebRTC connection. The existing property lookup remains an ElevenLabs
server tool. This pilot performs no CRM writes.

## Local test

From this directory, install `requirements.txt` in a Python 3.12 virtual
environment and run `python -m unittest -v`. The test runs actual local WebRTC
and RTP in both directions, with a mock ElevenLabs WebSocket. Local TCP and UDP
sockets must be available.

## Hosting and activation

Run the Dockerfile on a long-running runtime. Terminate HTTPS at the service
ingress. Start with one replica because active call state lives in memory.
Supply a working TURN service and verify the selected ICE route using a
remote WebRTC client before exposing the pilot to Meta.

Set these runtime variables through secret management:

- `ELEVENLABS_API_KEY` with access to the existing Maia pilot.
- `MAIA_BRIDGE_TOKEN` with a random shared token of at least 32 ASCII bytes.
- `MAIA_ICE_SERVER_URL`, `MAIA_ICE_USERNAME` and `MAIA_ICE_CREDENTIAL`
  for the remote ICE/TURN path. Use a relay deployment capable of bidirectional
  RTP and verify UDP reachability. The HTTPS ingress handles signaling only.

In the Fluxknight deployment, set the bridge's HTTPS origin in
`MAIA_ELEVENLABS_BRIDGE_URL` and its shared token in
`MAIA_ELEVENLABS_BRIDGE_TOKEN`. Bind the pilot to one test caller's E.164
digits in `MAIA_ELEVENLABS_PILOT_CALLER` and the existing Limitless Meta Phone
Number ID in `MAIA_ELEVENLABS_PILOT_PHONE_NUMBER_ID`.
The existing `MAIA_WHATSAPP_CALLING_ENABLED` switch must be on. Leave
`MAIA_ELEVENLABS_PILOT_ENABLED` unset until a remote WebRTC client has verified
audio against the real ElevenLabs agent with the hosted service.

Then enable the pilot for the selected caller and run a controlled WhatsApp
call. Verify an audible greeting, speech in both directions, interruption,
property lookup, a call exceeding 60 seconds, and hangup on both sides. Verify
that a different caller still takes the existing route and that Meta
WhatsApp messaging reaches the existing webhook. Logs correlate the provider
accept with the bridge's session ID. Never log SDP, speech, provider response
bodies or credentials.

## Rollback and limits

Disable `MAIA_ELEVENLABS_PILOT_ENABLED` and redeploy Fluxknight to send new
calls through the existing path. The bridge closes on a Meta terminate event,
peer failure, provider socket close, or duration limit. Locally closing the
peer does not send a separate Meta Graph terminate request. The pilot has
not established carrier-side hangup behavior for that case. Active sessions
are lost on a bridge restart. Neither production Meta SIP settings nor the
number registration is part of this deployment.
