const WebSocket = require("ws");

/* =========================
   서버 생성
========================= */
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log("Signaling server running on port", PORT);

/* =========================
   방 관리
========================= */
// rooms = {
//   roomCode: Set<WebSocket>
// }
const rooms = {};

/* =========================
   연결 처리
========================= */
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

    /* ===== 방 참가 ===== */
    if (type === "join") {
      ws.room = room;

      if (!rooms[room]) {
        rooms[room] = new Set();
      }

      rooms[room].add(ws);
      return;
    }

    /* ===== 중계 ===== */
    if (!ws.room || !rooms[ws.room]) return;

    rooms[ws.room].forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    });
  });

  /* =========================
     연결 종료
  ========================= */
  ws.on("close", () => {
    const room = ws.room;
    if (!room || !rooms[room]) return;

    rooms[room].delete(ws);
    if (rooms[room].size === 0) {
      delete rooms[room];
    }
  });
});
