const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

/* HTTP (Render용) */
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WebSocket server running");
});

/* WebSocket */
const wss = new WebSocket.Server({ server });

/*
rooms = {
  roomCode: {
    clients: Set<WebSocket>,
    offer: RTCSessionDescription
  }
}
*/
const rooms = {};

wss.on("connection", (ws) => {
  ws.room = null;

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    const { type, room } = msg;

    /* ===== 참가 ===== */
    if (type === "join") {
      ws.room = room;

      if (!rooms[room]) {
        rooms[room] = {
          clients: new Set(),
          offer: null
        };
      }

      rooms[room].clients.add(ws);

      /* 🔥 핵심: 이미 공유 중이면 offer 즉시 전송 */
      if (rooms[room].offer) {
        ws.send(JSON.stringify({
          type: "offer",
          offer: rooms[room].offer
        }));
      }
      return;
    }

    if (!ws.room || !rooms[ws.room]) return;

    /* ===== offer 저장 ===== */
    if (type === "offer") {
      rooms[ws.room].offer = msg.offer;
    }

    /* ===== 방 안에 중계 ===== */
    rooms[ws.room].clients.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  });

  ws.on("close", () => {
    const room = ws.room;
    if (!room || !rooms[room]) return;

    rooms[room].clients.delete(ws);
    if (rooms[room].clients.size === 0) {
      delete rooms[room];
    }
  });
});

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
