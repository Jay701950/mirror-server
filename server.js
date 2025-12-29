// ==============================
// WebSocket Signaling Server
// ==============================
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// 방 목록
// rooms = {
//   "12": { host: ws, guest: ws }
// }
const rooms = {};

// ------------------------------
// 2자리 숫자 방 코드 생성
// ------------------------------
function createRoomCode() {
  return Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0"); // 00 ~ 99
}

// ------------------------------
// WebSocket 연결
// ------------------------------
wss.on("connection", (ws) => {

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    // ==========================
    // 방 생성
    // ==========================
    if (data.type === "create-room") {
      let code;

      // 중복 방 피하기
      do {
        code = createRoomCode();
      } while (rooms[code]);

      rooms[code] = { host: ws, guest: null };
      ws.roomCode = code;
      ws.role = "host";

      ws.send(JSON.stringify({
        type: "room-created",
        roomCode: code
      }));
    }

    // ==========================
    // 방 참가
    // ==========================
    if (data.type === "join-room") {
      const code = data.roomCode;

      if (!rooms[code] || rooms[code].guest) {
        ws.send(JSON.stringify({
          type: "error",
          message: "방이 없거나 이미 참가자가 있습니다"
        }));
        return;
      }

      rooms[code].guest = ws;
      ws.roomCode = code;
      ws.role = "guest";

      ws.send(JSON.stringify({
        type: "joined-room",
        roomCode: code
      }));

      // 호스트에게 참가자 입장 알림
      rooms[code].host.send(JSON.stringify({
        type: "peer-joined"
      }));
    }

    // ==========================
    // WebRTC Signaling 중계
    // ==========================
    if (
      data.type === "offer" ||
      data.type === "answer" ||
      data.type === "ice"
    ) {
      const code = ws.roomCode;
      if (!code || !rooms[code]) return;

      const room = rooms[code];
      const target =
        ws.role === "host" ? room.guest : room.host;

      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify(data));
      }
    }
  });

  // ==========================
  // 연결 종료
  // ==========================
  ws.on("close", () => {
    const code = ws.roomCode;
    if (!code || !rooms[code]) return;

    const room = rooms[code];

    // 호스트 나가면 방 삭제
    if (ws.role === "host") {
      if (room.guest && room.guest.readyState === WebSocket.OPEN) {
        room.guest.send(JSON.stringify({
          type: "error",
          message: "호스트 연결 종료"
        }));
      }
      delete rooms[code];
    }

    // 참가자 나가면 guest만 제거
    if (ws.role === "guest") {
      room.guest = null;
    }
  });
});

console.log(`Signaling server running on port ${PORT}`);
