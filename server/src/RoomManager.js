// RoomManager.js — Manages all active watch party rooms
//
// This is the single source of truth for every room in the application.
// It sits between MessageHandler (which handles raw socket events) and
// the Room/Participant domain classes (which hold the actual state).
//
// Two layers of storage are used together:
//
//   In-memory Map  →  rooms      Map<roomCode, Room>
//                     Fast O(1) lookups; holds the LIVE state (participants,
//                     video position, etc.) while the server is running.
//
//   SQLite (db.js) →  rooms table
//                     Persists room existence across server restarts.
//                     Only stores the room code + created_at timestamp.
//                     Participant list and video state are NOT persisted
//                     (they reset on restart — acceptable for this app).
//
// Why both?
//   • SQLite lets us validate a room code via GET /api/room/:code even after
//     a server restart (the in-memory Map would be empty after restart).
//   • The in-memory Map gives us instant access to live Room objects without
//     hitting the DB on every socket event.

import { v4 as uuidv4 } from 'uuid';    // generates unique user/room IDs
import { getDb, persist } from './db.js'; // async SQLite accessor + disk flush
import { Room } from './Room.js';          // Room domain class
import { Participant } from './Participant.js'; // Participant domain class

// ─── In-memory store ──────────────────────────────────────────────────────────
// All active rooms live here.  Key = roomCode (string), Value = Room instance.
const rooms = new Map();

// ─── generateRoomCode() ───────────────────────────────────────────────────────
// Creates a random 6-character uppercase alphanumeric code.
// Example output: "A3B9QZ", "X7MNPT"
//
// How it works:
//   1. uuidv4() generates a UUID like "550e8400-e29b-41d4-a716-446655440000"
//   2. .replace(/-/g, '') strips hyphens → "550e8400e29b41d4a716446655440000"
//   3. .toUpperCase() → "550E8400E29B41D4A716446655440000"
//   4. .slice(0, 6)   → "550E84"  (first 6 chars, always alphanumeric from UUID)
//
// Collision probability is negligible for a small-scale app but
// createRoom() checks for duplicates and regenerates if needed.
function generateRoomCode() {
  return uuidv4().replace(/-/g, '').toUpperCase().slice(0, 6);
}

// ─── createRoom(hostName) ─────────────────────────────────────────────────────
// Creates a brand-new room, persists it to SQLite, and returns the Room instance.
//
// Called by:  POST /api/room  (Block 5)
//
// Parameters:
//   hostName — display name of the room creator (used to create the host Participant)
//
// Returns:
//   { room, hostUserId }
//     room        — the new Room instance (in-memory)
//     hostUserId  — UUID for the host (sent back to the client so they
//                   can identify themselves in future socket events)
export async function createRoom(hostName) {
  const db = await getDb();

  // Generate a unique room code (retry if collision happens)
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code)); // extremely rare, but safe to handle

  // Persist the new room to SQLite
  // We only store code + timestamp — no participants or video state
  db.run(
    'INSERT INTO rooms (code, created_at) VALUES (?, ?)',
    [code, Date.now()]
  );
  persist(db); // flush in-memory SQLite → disk immediately

  // Create the in-memory Room instance
  const room = new Room(code, hostName);

  // Store it in our in-memory Map
  rooms.set(code, room);

  console.log(`[RoomManager] Room created: ${code} by "${hostName}"`);

  // Return the room AND a new UUID for the host.
  // The host's userId is generated HERE (server-side) so the client
  // receives it in the POST /api/room response and passes it in join_room.
  const hostUserId = uuidv4();
  return { room, hostUserId };
}

// ─── joinRoom(code, userId, displayName, socketId) ───────────────────────────
// Validates the room code, creates a Participant, adds them to the Room,
// and returns the updated Room instance.
//
// Called by:  join_room socket event handler (Block 4 — MessageHandler)
//
// Parameters:
//   code        — the 6-char room code the user typed
//   userId      — UUID sent by the client (from the POST /api/room response
//                 for the host, or generated client-side for joiners)
//   displayName — name the user typed in the join form
//   socketId    — the current socket.id for this connection
//
// Returns:
//   { room, participant }  on success
//   null                   if the room code doesn't exist in SQLite
export async function joinRoom(code, userId, displayName, socketId) {
  const db = await getDb();

  // Step 1: Check SQLite to confirm this room was ever created.
  // This is the authoritative check — even if the server restarted and
  // lost the in-memory Map, SQLite still knows the room exists.
  const result = db.exec(
    'SELECT code FROM rooms WHERE code = ?',
    [code]
  );

  // db.exec returns an array of result sets.
  // If the array is empty OR the first result set has no rows → room not found.
  const roomExists = result.length > 0 && result[0].values.length > 0;
  if (!roomExists) {
    console.log(`[RoomManager] joinRoom failed — code not found: ${code}`);
    return null;
  }

  // Step 2: Get or lazily recreate the in-memory Room instance.
  // "Lazy recreation" handles the edge case where the server restarted:
  // SQLite says the room exists, but the Map is empty.
  // In that case we create a fresh Room object (video state resets — acceptable).
  if (!rooms.has(code)) {
    console.log(`[RoomManager] Lazily restoring room ${code} from SQLite`);
    rooms.set(code, new Room(code, 'unknown'));
  }
  const room = rooms.get(code);

  // Step 3: Determine the role for this joiner.
  // The FIRST participant in the room becomes the host.
  // Everyone else gets 'participant' by default.
  // (Moderator role is only assigned later via assign_role event.)
  const role = room.participants.size === 0 ? 'host' : 'participant';

  // Step 4: Check if this userId is already in the room (e.g. reconnect).
  // If so, just update their socketId rather than adding a duplicate.
  if (room.participants.has(userId)) {
    const existing = room.participants.get(userId);
    existing.socketId = socketId; // refresh socket reference
    console.log(`[RoomManager] ${displayName} reconnected to room ${code}`);
    return { room, participant: existing };
  }

  // Step 5: Create a fresh Participant and add them to the Room.
  const participant = new Participant(userId, displayName, role, socketId);
  room.addParticipant(participant);

  console.log(`[RoomManager] "${displayName}" joined room ${code} as ${role}`);
  return { room, participant };
}

// ─── getRoom(code) ────────────────────────────────────────────────────────────
// Returns the in-memory Room for a given code, or null if not found.
//
// Called by:  MessageHandler before processing any socket event,
//             to get the Room the sender belongs to.
//
// Note: This only checks the in-memory Map (fast path).
// If the server restarted, the Map is empty — joinRoom() handles that case
// via lazy recreation from SQLite.
export function getRoom(code) {
  return rooms.get(code) || null;
}

// ─── roomExists(code) ─────────────────────────────────────────────────────────
// Checks SQLite to see if a room code is valid.
// Used by GET /api/room/:code (Block 5) to validate before the client joins.
//
// Returns: true | false
export async function roomExists(code) {
  const db = await getDb();
  const result = db.exec(
    'SELECT code FROM rooms WHERE code = ?',
    [code]
  );
  return result.length > 0 && result[0].values.length > 0;
}

// ─── removeRoom(code) ────────────────────────────────────────────────────────
// Deletes a room from both the in-memory Map and SQLite.
// Called when the last participant leaves (optional cleanup — currently
// wired up in MessageHandler's disconnect handler).
export async function removeRoom(code) {
  const db = await getDb();
  rooms.delete(code);
  db.run('DELETE FROM rooms WHERE code = ?', [code]);
  persist(db);
  console.log(`[RoomManager] Room ${code} deleted (empty)`);
}
