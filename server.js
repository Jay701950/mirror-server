const WebSocket = require("ws");
const http = require("http");

const server = http.createServer();
const wss = new WebSocket.Server({ server });

/**
 * rooms 구조:
 * {
 *   roomCode: Set<WebSocket>
 * }
 */
const rooms = {};

// 방 코드 생성
function createRoomCode() {
  return Math.random().toString(36).substring(2, 8);
}

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    // 방 생성
    if (data.type === "create-room") {
      const roomCode = createRoomCode();
      rooms[roomCode] = new Set();
      rooms[roomCode].add(ws);
      currentRoom = roomCode;

      ws.send(
        JSON.stringify({
          type: "room-created",
          roomCode,
        })
      );
      return;
    }

    // 방 참가
    if (data.type === "join-room") {
      const { roomCode } = data;
      if (!rooms[roomCode]) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "방이 존재하지 않습니다",
          })
        );
        return;
      }

      rooms[roomCode].add(ws);
      currentRoom = roomCode;

      ws.send(
        JSON.stringify({
          type: "joined-room",
          roomCode,
        })
      );
      return;
    }

    // WebRTC 시그널링 전달 (offer / answer / ice)
    if (
      data.type === "offer" ||
      data.type === "answer" ||
      data.type === "ice"
    ) {
      if (!currentRoom) return;

      rooms[currentRoom].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].delete(ws);
      if (rooms[currentRoom].size === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

// 🔴 Railway 대응용 (이게 핵심)
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
});
