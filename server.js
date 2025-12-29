const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

/* =========================
   HTTP (상태 확인용)
========================= */
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Signaling server running");
});

/* =========================
   WebSocket
========================= */
const wss = new WebSocket.Server({ server });

/*
rooms = {
  roomCode: {
    host: WebSocket,
    peers: Set<WebSocket>
  }
}
*/
const rooms = {};

/* =========================
   연결
========================= */
wss.on("connection", (ws) => {
  ws.roomCode = null;
  ws.isHost = false;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    /* =========================
       방 생성
    ========================= */
    if (msg.type === "create-room") {
      const roomCode = Math.random().toString(36).substring(2, 8);

      rooms[roomCode] = {
        host: ws,
        peers: new Set()
      };

      ws.roomCode = roomCode;
      ws.isHost = true;

      ws.send(JSON.stringify({
        type: "room-created",
        roomCode
      }));

      return;
    }

    /* =========================
       방 참가
    ========================= */
    if (msg.type === "join-room") {
      const room = rooms[msg.roomCode];
      if (!room) {
        ws.send(JSON.stringify({
          type: "error",
          message: "Room not found"
        }));
        return;
      }

      ws.roomCode = msg.roomCode;
      ws.isHost = false;
      room.peers.add(ws);

      ws.send(JSON.stringify({
        type: "joined-room",
        roomCode: msg.roomCode
      }));

      /* 🔥 호스트에게 참가 알림 */
      if (room.host && room.host.readyState === WebSocket.OPEN) {
        room.host.send(JSON.stringify({
          type: "peer-joined"
        }));
      }

      return;
    }

    /* =========================
       이후는 방 필요
    ========================= */
    const room = rooms[ws.roomCode];
    if (!room) return;

    /* =========================
       WebRTC 중계
    ========================= */
    if (msg.type === "offer") {
      // host → peers
      room.peers.forEach(peer => {
        if (peer.readyState === WebSocket.OPEN) {
          peer.send(JSON.stringify({
            type: "offer",
            offer: msg.offer
          }));
        }
      });
    }

    if (msg.type === "answer") {
      // peer → host
      if (room.host && room.host.readyState === WebSocket.OPEN) {
        room.host.send(JSON.stringify({
          type: "answer",
          answer: msg.answer
        }));
      }
    }

    if (msg.type === "ice") {
      // 서로 전달
      if (ws.isHost) {
        room.peers.forEach(peer => {
          if (peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({
              type: "ice",
              candidate: msg.candidate
            }));
          }
        });
      } else {
        if (room.host && room.host.readyState === WebSocket.OPEN) {
          room.host.send(JSON.stringify({
            type: "ice",
            candidate: msg.candidate
          }));
        }
      }
    }
  });

  /* =========================
     연결 종료
  ========================= */
  ws.on("close", () => {
    const room = rooms[ws.roomCode];
    if (!room) return;

    if (ws.isHost) {
      // 방 폭파
      room.peers.forEach(p => {
        if (p.readyState === WebSocket.OPEN) {
          p.close();
        }
      });
      delete rooms[ws.roomCode];
    } else {
      room.peers.delete(ws);
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
