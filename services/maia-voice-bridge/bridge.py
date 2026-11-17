"""Single-process WebRTC to ElevenLabs media transport for the Maia pilot."""

import asyncio
import base64
import binascii
from fractions import Fraction
import hmac
import logging
import os
from uuid import UUID

from aiohttp import ClientSession, ClientTimeout, WSMsgType, web
from aiortc import MediaStreamTrack, RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCRtpSender, RTCSessionDescription
from aiortc.mediastreams import MediaStreamError
from av import AudioFrame, AudioResampler

RATE = 16000
FRAME_SAMPLES = 320
FRAME_BYTES = FRAME_SAMPLES * 2
MAX_AUDIO_BUFFER = RATE * 2 * 4
MAX_CALL_SECONDS = 600
SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
AGENT_ID = "agent_3001m7mgjzdff0e80qtetmfqdenx"
log = logging.getLogger("maia_voice_bridge")


class Playback(MediaStreamTrack):
    kind = "audio"

    def __init__(self, call_id=None):
        super().__init__()
        self.call_id = call_id
        self.buffer = bytearray()
        self.samples_sent = 0
        self.next_frame = None
        self.spoke = False

    def append(self, audio):
        if len(audio) % 2 or len(self.buffer) + len(audio) > MAX_AUDIO_BUFFER:
            raise ValueError("invalid or excessive agent audio")
        self.buffer.extend(audio)

    async def recv(self):
        if self.readyState != "live":
            raise MediaStreamError
        clock = asyncio.get_running_loop().time
        now = clock()
        self.next_frame = max(now, self.next_frame or now)
        await asyncio.sleep(max(0, self.next_frame - clock()))
        self.next_frame += FRAME_SAMPLES / RATE
        audio = bytes(self.buffer[:FRAME_BYTES])
        del self.buffer[:FRAME_BYTES]
        frame = AudioFrame(format="s16", layout="mono", samples=FRAME_SAMPLES)
        frame.planes[0].update(audio.ljust(FRAME_BYTES, b"\0"))
        frame.sample_rate = RATE
        frame.time_base = Fraction(1, RATE)
        frame.pts = self.samples_sent
        self.samples_sent += FRAME_SAMPLES
        if audio and not self.spoke:
            self.spoke = True
            log.info("playback_started call=%s", self.call_id)
        return frame


async def connect_agent(http, api_key):
    from yarl import URL

    async with http.get(
        SIGNED_URL, params={"agent_id": AGENT_ID, "include_conversation_id": "true"},
        headers={"xi-api-key": api_key}, allow_redirects=False,
    ) as response:
        if response.status != 200:
            raise RuntimeError("signed_url_rejected")
        url = URL((await response.json())["signed_url"])
    if url.scheme != "wss" or url.host != "api.elevenlabs.io" or url.path != "/v1/convai/conversation":
        raise RuntimeError("invalid_signed_url")
    return await http.ws_connect(url, heartbeat=15, max_msg_size=262144)


class Call:
    def __init__(self, call_id, configuration):
        self.id = call_id
        self.peer = RTCPeerConnection(configuration)
        self.playback = Playback(call_id)
        self.ws = None
        self.tasks = set()
        self.ready = asyncio.Event()
        self.closed = asyncio.Event()
        self.connected = asyncio.Event()
        self.remote_audio = None
        self.peer.on("track", self.on_track)
        self.peer.on("connectionstatechange", self.on_state)
        self.audio_sender = self.peer.addTrack(self.playback)
        transceiver = next(item for item in self.peer.getTransceivers() if item.sender == self.audio_sender)
        transceiver.setCodecPreferences([
            codec for codec in RTCRtpSender.getCapabilities("audio").codecs
            if codec.mimeType.lower() == "audio/opus"
        ])

    def on_track(self, track):
        if track.kind == "audio" and self.remote_audio is None:
            self.remote_audio = track

    def on_state(self):
        if self.peer.connectionState == "connected":
            self.connected.set()
            log.info("peer_connected call=%s", self.id)
        if self.peer.connectionState in {"failed", "closed"}:
            self.closed.set()

    def start(self, operation):
        task = asyncio.create_task(operation)
        self.tasks.add(task)
        task.add_done_callback(self.task_done)

    def task_done(self, task):
        self.tasks.discard(task)
        if not task.cancelled():
            error = task.exception()
            if error:
                log.warning("media_task_failed call=%s type=%s", self.id, type(error).__name__)
            self.closed.set()

    async def prepare(self, sdp, open_agent):
        await self.peer.setRemoteDescription(RTCSessionDescription(sdp=sdp, type="offer"))
        if self.remote_audio is None or len(self.peer.getTransceivers()) != 1:
            raise ValueError("one inbound audio track required")
        await self.peer.setLocalDescription(await self.peer.createAnswer())
        if " opus/48000" not in self.peer.localDescription.sdp.lower():
            raise ValueError("opus negotiation required")
        self.ws = await open_agent()
        await self.ws.send_json({"type": "conversation_initiation_client_data"})
        self.start(self.receive_agent())
        await self.ready.wait()
        if self.closed.is_set():
            raise RuntimeError("agent_closed_during_setup")
        self.start(self.send_caller_audio())
        return self.peer.localDescription.sdp

    async def receive_agent(self):
        async for message in self.ws:
            if message.type != WSMsgType.TEXT:
                break
            event = message.json()
            kind = event.get("type")
            if kind == "conversation_initiation_metadata":
                metadata = event["conversation_initiation_metadata_event"]
                if any(metadata.get(key) != "pcm_16000" for key in (
                    "user_input_audio_format", "agent_output_audio_format",
                )):
                    raise ValueError("unsupported agent audio format")
                self.ready.set()
                log.info("agent_ready call=%s", self.id)
            elif kind == "ping":
                await self.ws.send_json({"type": "pong", "event_id": event["ping_event"]["event_id"]})
            elif kind == "interruption":
                self.playback.buffer.clear()
            elif kind == "audio" and self.ready.is_set():
                try:
                    self.playback.append(base64.b64decode(event["audio_event"]["audio_base_64"], validate=True))
                except binascii.Error as error:
                    raise ValueError("invalid agent audio encoding") from error

    async def send_caller_audio(self):
        resample = AudioResampler(format="s16", layout="mono", rate=RATE)
        first = True
        while True:
            for frame in resample.resample(await self.remote_audio.recv()):
                pcm = bytes(frame.planes[0])[:frame.samples * 2]
                async with asyncio.timeout(1):
                    await self.ws.send_json({"user_audio_chunk": base64.b64encode(pcm).decode("ascii")})
                if first:
                    log.info("caller_audio_received call=%s", self.id)
                    first = False

    async def close(self):
        self.closed.set()
        tasks = list(self.tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self.playback.stop()
        await self.peer.close()
        if self.ws is not None:
            await self.ws.close()


def create_app(secret, configuration, open_agent, max_calls=2):
    if len(secret) < 32 or not secret.isascii():
        raise ValueError("bridge token must contain at least 32 ASCII characters")
    authorization = f"Bearer {secret}".encode()
    app = web.Application(client_max_size=65536)
    calls = {}
    supervisors = set()

    async def supervise(call):
        try:
            async with asyncio.timeout(20):
                while not call.connected.is_set() and not call.closed.is_set():
                    await asyncio.sleep(0.1)
            await asyncio.wait_for(call.closed.wait(), MAX_CALL_SECONDS)
        except TimeoutError:
            log.warning("session_timeout call=%s connected=%s", call.id, call.connected.is_set())
        finally:
            try:
                await call.close()
            finally:
                calls.pop(call.id, None)
                log.info("session_closed call=%s", call.id)

    async def offer(request):
        if not hmac.compare_digest(request.headers.get("Authorization", "").encode(), authorization):
            raise web.HTTPUnauthorized()
        try:
            body = await request.json()
            call_id = str(UUID(body["id"]))
            sdp = body["sdp"]
            if not isinstance(sdp, str) or not sdp.startswith("v=0"):
                raise ValueError
        except (ValueError, KeyError, TypeError):
            raise web.HTTPBadRequest() from None
        if call_id in calls:
            raise web.HTTPConflict()
        if len(calls) >= max_calls:
            raise web.HTTPServiceUnavailable()
        call = Call(call_id, configuration)
        calls[call_id] = call
        try:
            async with asyncio.timeout(8):
                answer = await call.prepare(sdp, open_agent)
        except (Exception, asyncio.CancelledError) as error:
            calls.pop(call.id, None)
            await call.close()
            if isinstance(error, asyncio.CancelledError):
                raise
            log.warning("setup_failed call=%s type=%s", call_id, type(error).__name__)
            raise web.HTTPBadGateway() from None
        supervisor = asyncio.create_task(supervise(call))
        supervisors.add(supervisor)
        supervisor.add_done_callback(supervisors.discard)
        return web.json_response({"sdp": answer}, headers={"Cache-Control": "no-store"})

    async def end(request):
        if not hmac.compare_digest(request.headers.get("Authorization", "").encode(), authorization):
            raise web.HTTPUnauthorized()
        call = calls.get(request.match_info["call_id"])
        if call:
            call.closed.set()
        return web.Response(status=204)

    async def cleanup(_app):
        for call in calls.values():
            call.closed.set()
        await asyncio.gather(*supervisors, return_exceptions=True)

    app.router.add_get("/health", health)
    app.router.add_post("/calls", offer)
    app.router.add_delete("/calls/{call_id}", end)
    app.on_cleanup.append(cleanup)
    return app


async def health(_request):
    return web.json_response({"ok": True})


async def production_app():
    secret = os.environ["MAIA_BRIDGE_TOKEN"]
    api_key = os.environ["ELEVENLABS_API_KEY"]
    urls = os.environ["MAIA_ICE_SERVER_URL"]
    servers = [RTCIceServer(
        urls=urls, username=os.getenv("MAIA_ICE_USERNAME"),
        credential=os.getenv("MAIA_ICE_CREDENTIAL"),
    )]
    http = ClientSession(timeout=ClientTimeout(total=5))
    try:
        app = create_app(secret, RTCConfiguration(iceServers=servers), lambda: connect_agent(http, api_key))
    except Exception:
        await http.close()
        raise

    async def close_http(_app):
        await http.close()

    app.on_cleanup.append(close_http)
    return app


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    web.run_app(
        production_app(), host="0.0.0.0", port=int(os.getenv("PORT", "8080")),
        handler_cancellation=True, access_log=None,
    )
