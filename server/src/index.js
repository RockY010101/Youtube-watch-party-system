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
import { createRoom, roomExists } from './RoomManager.js'; // Block 5 — REST handlers

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

// ── POST /api/room ────────────────────────────────────────────────────────────
// Creates a brand-new watch party room.
//
// Request body:  { displayName: string }
//   displayName — the host's chosen display name (e.g. "Alice")
//
// Response:      { code: string, userId: string }
//   code   — the 6-char room code the host shares with friends
//   userId — a UUID the host stores in memory/state and sends with join_room
//            so the server knows who the host is when they connect via WebSocket
//
// Why generate userId here (server-side) instead of on the client?
//   Generating it here ties the userId to the room creation event, making
//   it easy to mark that user as 'host' when they later send join_room.
//   The client just stores it and passes it along — no trust issues.
app.post('/api/room', async (req, res) => {
  try {
    const { displayName } = req.body;

    // Validate input — displayName is required and must be a non-empty string
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return res.status(400).json({ error: 'displayName is required.' });
    }

    // Delegate to RoomManager which generates the code, persists to SQLite,
    // creates the in-memory Room instance, and returns both pieces of data.
    const { room, hostUserId } = await createRoom(displayName.trim());

    console.log(`[REST] POST /api/room → code=${room.roomCode} host=${displayName.trim()}`);

    // Return the code and userId to the client
    return res.status(201).json({
      code:   room.roomCode,
      userId: hostUserId,
    });
  } catch (err) {
    console.error('[REST] POST /api/room error:', err);
    return res.status(500).json({ error: 'Failed to create room.' });
  }
});

// ── GET /api/room/:code ───────────────────────────────────────────────────────
// Validates whether a room code exists BEFORE the client attempts to join.
//
// Called by the Home page's "Join Room" form:  the client hits this endpoint
// when the user clicks "Join", and only navigates to /room/:code if
// { exists: true } is returned.  This prevents users from joining a ghost room
// and then immediately getting an error from the WebSocket join_room event.
//
// URL param: :code — the 6-char room code the user typed
//
// Response:  { exists: boolean }
//   exists: true  → safe to navigate and connect
//   exists: false → show an error in the join form ("Room not found")
//
// Note: We check SQLite (via roomExists) not the in-memory Map,
// because the Map is empty after a server restart while SQLite retains history.
app.get('/api/room/:code', async (req, res) => {
  try {
    // Normalise to uppercase so "a3b9qz" and "A3B9QZ" both work
    const code = req.params.code.toUpperCase().trim();

    const exists = await roomExists(code);

    console.log(`[REST] GET /api/room/${code} → exists=${exists}`);

    return res.json({ exists });
  } catch (err) {
    console.error('[REST] GET /api/room/:code error:', err);
    return res.status(500).json({ error: 'Failed to check room.' });
  }
});

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
