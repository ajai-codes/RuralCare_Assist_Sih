import json
import logging
from typing import Dict, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("ruralcare.signaling")

router = APIRouter(tags=["signaling"])

class ConnectionManager:
    def __init__(self):
        # Maps room_id -> list of active WebSocket connections
        self.active_rooms: Dict[str, List[WebSocket]] = {}
        # Maps WebSocket -> metadata dict (room_id, role, user_id)
        self.socket_meta: Dict[WebSocket, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_rooms:
            self.active_rooms[room_id] = []
        self.active_rooms[room_id].append(websocket)
        self.socket_meta[websocket] = {"room_id": room_id}
        logger.info(f"WebSocket connected to room {room_id}. Total in room: {len(self.active_rooms[room_id])}")

    def disconnect(self, websocket: WebSocket):
        meta = self.socket_meta.pop(websocket, None)
        if meta:
            room_id = meta.get("room_id")
            if room_id and room_id in self.active_rooms:
                if websocket in self.active_rooms[room_id]:
                    self.active_rooms[room_id].remove(websocket)
                if len(self.active_rooms[room_id]) == 0:
                    del self.active_rooms[room_id]
                logger.info(f"WebSocket disconnected from room {room_id}")

    async def broadcast_to_room(self, message: dict, sender: WebSocket, room_id: str):
        if room_id not in self.active_rooms:
            return
        msg_str = json.dumps(message)
        for client in self.active_rooms[room_id]:
            if client != sender:
                try:
                    await client.send_text(msg_str)
                except Exception as e:
                    logger.warning(f"Failed to send message to peer in room {room_id}: {e}")

manager = ConnectionManager()

@router.websocket("/ws/teleconsultation/{room_id}")
async def teleconsultation_signaling(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        # Notify joining client of peer count
        peer_count = len(manager.active_rooms.get(room_id, []))
        await websocket.send_text(json.dumps({
            "type": "room-info",
            "room_id": room_id,
            "peers_count": peer_count,
            "is_initiator": peer_count == 1
        }))

        # If second peer joined, notify the first peer
        if peer_count > 1:
            await manager.broadcast_to_room(
                {"type": "peer-joined", "room_id": room_id, "peers_count": peer_count},
                websocket,
                room_id
            )

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            msg_type = msg.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif msg_type in ["offer", "answer", "ice-candidate", "reconnect-request"]:
                # Forward WebRTC signaling payload directly to the other peer in the room
                await manager.broadcast_to_room(msg, websocket, room_id)
            elif msg_type == "join":
                role = msg.get("role", "patient")
                user_id = msg.get("userId", "")
                if websocket in manager.socket_meta:
                    manager.socket_meta[websocket]["role"] = role
                    manager.socket_meta[websocket]["user_id"] = user_id
                await manager.broadcast_to_room(
                    {"type": "peer-ready", "role": role, "userId": user_id},
                    websocket,
                    room_id
                )
            elif msg_type == "leave":
                await manager.broadcast_to_room(
                    {"type": "peer-left", "room_id": room_id},
                    websocket,
                    room_id
                )
                break
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_to_room(
            {"type": "peer-left", "room_id": room_id},
            websocket,
            room_id
        )
    except Exception as e:
        logger.error(f"Signaling exception in room {room_id}: {e}")
        manager.disconnect(websocket)
        await manager.broadcast_to_room(
            {"type": "peer-left", "room_id": room_id},
            websocket,
            room_id
        )
