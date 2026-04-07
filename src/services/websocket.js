const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// gameId -> Set of ws clients
const gameRooms = new Map();

// userId -> ws
const userSockets = new Map();

function broadcast(gameId, message) {
  const room = gameRooms.get(gameId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function joinRoom(gameId, ws) {
  if (!gameRooms.has(gameId)) gameRooms.set(gameId, new Set());
  gameRooms.get(gameId).add(ws);
  ws.gameId = gameId;
}

function leaveRoom(ws) {
  if (ws.gameId && gameRooms.has(ws.gameId)) {
    gameRooms.get(ws.gameId).delete(ws);
    if (gameRooms.get(ws.gameId).size === 0) {
      gameRooms.delete(ws.gameId);
    }
  }
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    // Auth via token query param
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const gameId = url.searchParams.get('game');

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        ws.userId = decoded.userId;
        userSockets.set(decoded.userId, ws);
      } catch {}
    }

    if (gameId) {
      joinRoom(gameId, ws);
      // Send spectator count
      const room = gameRooms.get(gameId);
      broadcast(gameId, { type: 'spectators', count: room ? room.size : 0 });
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'join' && msg.gameId) {
          leaveRoom(ws);
          joinRoom(msg.gameId, ws);
          const room = gameRooms.get(msg.gameId);
          broadcast(msg.gameId, { type: 'spectators', count: room ? room.size : 0 });
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }

      } catch {}
    });

    ws.on('close', () => {
      if (ws.userId) userSockets.delete(ws.userId);
      leaveRoom(ws);
      if (ws.gameId) {
        const room = gameRooms.get(ws.gameId);
        broadcast(ws.gameId, { type: 'spectators', count: room ? room.size : 0 });
      }
    });
  });

  return wss;
}

module.exports = { setupWebSocket, broadcast, userSockets };
