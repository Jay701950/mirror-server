const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log("Signaling server running : ws://localhost:" + PORT);

// roomCode -> Set of clients
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on("connection", (ws) => {
  let currentRoom = null;

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    // =========================
    // 방 생성 (호스트)
    // =========================
    if (data.type === "create-room") {
      const roomCode = generateRoomCode();
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

    // =========================
    // 방 참가 (시청자)
    // =========================
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

      // 참가자에게 참가 완료 알림
      ws.send(
        JSON.stringify({
          type: "joined-room",
          roomCode,
        })
      );

      // 🔥 방장에게 참가자 들어왔음을 알림
      rooms[roomCode].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "peer-joined",
            })
          );
        }
      });

      return;
    }

    // =========================
    // WebRTC 시그널 중계
    // =========================
    if (
      data.type === "offer" ||
      data.type === "answer" ||
      data.type === "ice"
    ) {
      if (!currentRoom || !rooms[currentRoom]) return;

      rooms[currentRoom].forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
      return;
    }
  });

  // =========================
  // 연결 종료 처리
  // =========================
  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].delete(ws);

      if (rooms[currentRoom].size === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});
