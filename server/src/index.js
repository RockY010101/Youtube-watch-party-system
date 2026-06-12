// index.js — Express + Socket.IO entry point
//
// Responsibilities:
//   1. Create the Express app and wrap it in a Node HTTP server
//   2. Attach Socket.IO to that same HTTP server
//   3. Configure CORS for BOTH the REST layer and the WebSocket layer
//   4. Mount the health-check route
//   5. Boot only after SQLite is ready (async main)

import 'dotenv/config';                     // loads .env into process.env
import express from 'express';
import { createServer } from 'http';        // Node built-in HTTP module
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { getDb } from './db.js';            // async WASM-based SQLite init
import { registerHandlers } from './MessageHandler.js'; // Block 4 — all socket events

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// CLIENT_URL can be comma-separated to whitelist multiple origins
// e.g.  CLIENT_URL=http://localhost:5173,https://my-app.vercel.app
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());       // parse JSON request bodies (POST /api/room)
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));

// ─── HTTP Server ─────────────────────────────────────────────────────────────
// Wrapping Express in http.createServer lets Socket.IO and Express
// share the same port — HTTP requests → Express, WS upgrades → Socket.IO
const httpServer = createServer(app);

// ─── Socket.IO Server ────────────────────────────────────────────────────────
// Socket.IO needs its own CORS config separate from Express middleware
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// ─── Socket.IO Connection Handler ────────────────────────────────────────────
// Every time a client calls socket.connect(), this fires.
// Block 4 (MessageHandler) will register all game events here.
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  // Register all game/room event handlers for this socket (Block 4)
  registerHandlers(socket);
});

// ─── REST Routes ─────────────────────────────────────────────────────────────

// Health check — used by Render to verify the service is alive
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Block 5 will add:
//   POST /api/room        → create a room, return { code, userId }
//   GET  /api/room/:code  → validate a room code, return { exists }

// ─── Startup ─────────────────────────────────────────────────────────────────
// Wrapped in async so we can await SQLite WASM init before accepting traffic
async function main() {
  await getDb();   // initialise DB, create schema, persist to disk

  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] allowed origins: ${allowedOrigins.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});

// Export io so MessageHandler (Block 4) can broadcast to rooms
export { io };
