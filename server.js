const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });
const rooms = {};

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg);
    ws.room = data.room;

    rooms[ws.room] ??= [];
    if (!rooms[ws.room].includes(ws)) {
      rooms[ws.room].push(ws);
    }

    rooms[ws.room].forEach(client => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    if (ws.room) {
      rooms[ws.room] = rooms[ws.room].filter(c => c !== ws);
    }
  });
});

console.log("Signaling server running : ws://localhost:3000");
