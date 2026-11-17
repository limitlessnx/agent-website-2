import asyncio
import base64
import struct
import unittest
from uuid import uuid4

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
from aiortc import RTCConfiguration, RTCPeerConnection, RTCSessionDescription

from bridge import FRAME_SAMPLES, Playback, create_app


class BridgeTest(unittest.IsolatedAsyncioTestCase):
    async def test_webrtc_audio_in_both_directions(self):
        caller_audio = asyncio.Event()
        pong = asyncio.Event()
        greeting = struct.pack("<" + "h" * FRAME_SAMPLES, *(
            10000 if i % 40 < 20 else -10000 for i in range(FRAME_SAMPLES)
        ))
        mock = web.Application()

        async def conversation(request):
            ws = web.WebSocketResponse()
            await ws.prepare(request)
            self.assertEqual((await ws.receive_json())["type"], "conversation_initiation_client_data")
            await ws.send_json({
                "type": "conversation_initiation_metadata",
                "conversation_initiation_metadata_event": {
                    "user_input_audio_format": "pcm_16000", "agent_output_audio_format": "pcm_16000",
                },
            })
            await ws.send_json({"type": "ping", "ping_event": {"event_id": 12}})
            await ws.send_json({
                "type": "audio", "audio_event": {"audio_base_64": base64.b64encode(greeting * 10).decode()},
            })
            async for message in ws:
                event = message.json()
                if event.get("type") == "pong" and event["event_id"] == 12:
                    pong.set()
                if event.get("user_audio_chunk") and any(base64.b64decode(event["user_audio_chunk"])):
                    caller_audio.set()
            return ws

        mock.router.add_get("/conversation", conversation)
        async with TestClient(TestServer(mock)) as agent:
            config = RTCConfiguration(iceServers=[])
            secret = "fixture-bridge-token-not-a-secret-123"
            app = create_app(secret, config, lambda: agent.ws_connect("/conversation"))
            async with TestClient(TestServer(app)) as bridge:
                peer = RTCPeerConnection(config)
                self.addAsyncCleanup(peer.close)
                remote = asyncio.get_running_loop().create_future()

                @peer.on("track")
                def on_track(track):
                    remote.set_result(track)

                source = Playback()
                source.append(greeting * 25)
                peer.addTrack(source)
                await peer.setLocalDescription(await peer.createOffer())
                body = {"id": str(uuid4()), "sdp": peer.localDescription.sdp}
                headers = {"Authorization": f"Bearer {secret}"}
                self.assertEqual((await bridge.post("/calls", json=body)).status, 401)
                response = await bridge.post("/calls", json=body, headers=headers)
                self.assertEqual(response.status, 200)
                self.assertEqual((await bridge.post("/calls", json=body, headers=headers)).status, 409)
                answer = await response.json()
                await peer.setRemoteDescription(RTCSessionDescription(answer["sdp"], "answer"))
                async with asyncio.timeout(8):
                    track = await remote
                    while True:
                        frame = await track.recv()
                        if any(bytes(frame.planes[0])[:frame.samples * 4]):
                            break
                    await caller_audio.wait()
                    await pong.wait()
                self.assertEqual((await bridge.delete(f"/calls/{body['id']}", headers=headers)).status, 204)
