// MessageHandler.js — All Socket.IO event handlers with role enforcement
//
// This file is the communication layer between clients and the server.
// It is called once per socket connection (from index.js) and registers
// all event listeners on that individual socket.
//
// Flow for every incoming event:
//   1. Extract userId + roomCode from the socket's own metadata
//   2. Look up the Room and Participant from RoomManager
//   3. Check permissions (canControl / canManage) before ANY state mutation
//   4. Update Room state
//   5. Broadcast the result to other participants
//
// Socket.IO "rooms" (the library concept) vs Watch-Party "rooms" (our concept):
//   Socket.IO has a built-in concept of "rooms" — named channels that sockets
//   can join. We use the roomCode string as the Socket.IO room name so that
//   io.to(roomCode).emit(...) sends to everyone watching that party.

import {
  joinRoom,
  getRoom,
  removeRoom,
} from './RoomManager.js';

// ─── registerHandlers(socket) ─────────────────────────────────────────────────
// Called from index.js inside io.on('connection', ...) for every new socket.
// Registers all event listeners on the socket object.
//
// Each listener is an async function so we can await RoomManager calls safely.
export function registerHandlers(socket) {

  // ─── join_room ─────────────────────────────────────────────────────────────
  // The very first event a client sends after connecting.
  // Payload: { code, userId, displayName }
  //
  // Steps:
  //   1. Call RoomManager.joinRoom() — validates code, creates Participant
  //   2. socket.join(code) — adds this socket to the Socket.IO room channel
  //   3. Emit joined_room back to THIS client with the full room snapshot
  //   4. Broadcast user_joined to EVERYONE ELSE in the room
  //
  // We store userId and roomCode on the socket object itself so every other
  // handler can access them without the client resending them each time.
  socket.on('join_room', async ({ code, userId, displayName }) => {
    try {
      const result = await joinRoom(code, userId, displayName, socket.id);

      if (!result) {
        // Room code not found in SQLite
        socket.emit('error', { message: `Room "${code}" does not exist.` });
        return;
      }

      const { room, participant } = result;

      // Tag the socket with identity info — used by all other handlers
      // and crucially by the 'disconnect' handler to clean up properly.
      socket.userId   = userId;
      socket.roomCode = code;

      // Join the Socket.IO room channel for this room code
      // After this line, io.to(code).emit(...) will reach this socket.
      socket.join(code);

      // Send the full room state back to the joining client only.
      // The client uses this to:
      //   • Render the participant list
      //   • Load the correct video URL
      //   • Seek the player to the effective current time
      socket.emit('joined_room', {
        room: room.toJSON(),  // full snapshot (video state + all participants)
        you:  participant.toJSON(), // tells the client their own role
      });

      // Tell everyone else in the room that a new user arrived.
      // 'except(socket.id)' skips the sender — they already know they joined.
      socket.to(code).emit('user_joined', { participant: participant.toJSON() });

      console.log(`[MSG] ${displayName} joined room ${code} as ${participant.role}`);
    } catch (err) {
      console.error('[MSG] join_room error:', err);
      socket.emit('error', { message: 'Failed to join room.' });
    }
  });

  // ─── Helper: getAuthorizedParticipant(requireControl, requireManage) ────────
  // DRY helper used by play / pause / seek / change_video / assign_role /
  // remove_participant handlers.
  //
  // Returns { room, participant } if everything is valid and the participant
  // has the required permission level.
  // Returns null and emits an error to the socket if anything is wrong.
  function getAuthorizedParticipant(requireControl = false, requireManage = false) {
    // If this socket never sent join_room (or got cleaned up), bail out.
    if (!socket.roomCode || !socket.userId) {
      socket.emit('error', { message: 'You are not in a room.' });
      return null;
    }

    const room = getRoom(socket.roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return null;
    }

    const participant = room.getParticipant(socket.userId);
    if (!participant) {
      socket.emit('error', { message: 'Participant not found.' });
      return null;
    }

    // Permission gate — checked BEFORE any state mutation
    if (requireManage && !participant.canManage()) {
      socket.emit('error', { message: 'Only the host can perform this action.' });
      return null;
    }
    if (requireControl && !participant.canControl()) {
      socket.emit('error', { message: 'Only the host or moderator can control playback.' });
      socket.emit('sync_state', {
        videoUrl:    room.videoUrl,
        playing:     room.videoState.playing,
        currentTime: room.getEffectiveCurrentTime(),
        participants: Array.from(room.participants.values()).map(p => p.toJSON()),
      });
      return null;
    }

    return { room, participant };
  }

  // ─── play ──────────────────────────────────────────────────────────────────
  // Payload: { currentTime }
  //
  // The client sends the exact time at which they pressed play.
  // We update the room's video state then broadcast sync_state to everyone
  // EXCEPT the sender (they're already playing — no need to seek themselves).
  socket.on('play', ({ currentTime }) => {
    const auth = getAuthorizedParticipant(true); // requireControl = true
    if (!auth) return;

    const { room } = auth;

    // Update the canonical room state
    room.updateVideoState({ playing: true, currentTime });

    // Broadcast to everyone else so their players start playing
    room.broadcast('sync_state', {
      videoUrl:    room.videoUrl,
      playing:     true,
      currentTime: room.getEffectiveCurrentTime(),
      participants: Array.from(room.participants.values()).map(p => p.toJSON()),
    }, socket.id); // exclude sender

    console.log(`[MSG] play @ ${currentTime}s in room ${room.roomCode}`);
  });

  // ─── pause ─────────────────────────────────────────────────────────────────
  // Payload: { currentTime }
  //
  // Same pattern as play — update state, broadcast to others.
  socket.on('pause', ({ currentTime }) => {
    const auth = getAuthorizedParticipant(true);
    if (!auth) return;

    const { room } = auth;

    room.updateVideoState({ playing: false, currentTime });

    room.broadcast('sync_state', {
      videoUrl:    room.videoUrl,
      playing:     false,
      currentTime: currentTime, // paused: no drift calculation needed
      participants: Array.from(room.participants.values()).map(p => p.toJSON()),
    }, socket.id);

    console.log(`[MSG] pause @ ${currentTime}s in room ${room.roomCode}`);
  });

  // ─── seek ──────────────────────────────────────────────────────────────────
  // Payload: { currentTime }
  //
  // Seek keeps the current playing/paused state but jumps to a new time.
  // Everyone in the room (including the sender) needs to seek,
  // so we do NOT exclude the sender here.
  socket.on('seek', ({ currentTime }) => {
    const auth = getAuthorizedParticipant(true);
    if (!auth) return;

    const { room } = auth;

    // Keep playing/paused as-is, just update the time
    room.updateVideoState({ currentTime });

    // Broadcast to EVERYONE (including sender) because seek should be applied
    // universally to avoid the sender being at a different position
    room.broadcast('sync_state', {
      videoUrl:    room.videoUrl,
      playing:     room.videoState.playing,
      currentTime: room.getEffectiveCurrentTime(),
      participants: Array.from(room.participants.values()).map(p => p.toJSON()),
    });

    console.log(`[MSG] seek → ${currentTime}s in room ${room.roomCode}`);
  });

  // ─── change_video ──────────────────────────────────────────────────────────
  // Payload: { url }
  //
  // Host or moderator pastes a new YouTube URL.
  // We reset playback to 0 and paused state, then sync everyone.
  socket.on('change_video', ({ url }) => {
    const auth = getAuthorizedParticipant(true);
    if (!auth) return;

    const { room } = auth;

    // Update the room's video URL and reset playback state to beginning
    room.videoUrl = url;
    room.updateVideoState({ playing: false, currentTime: 0 });

    // Broadcast to EVERYONE (including the sender) so all players load the new video
    room.broadcast('sync_state', {
      videoUrl:    url,
      playing:     false,
      currentTime: 0,
      participants: Array.from(room.participants.values()).map(p => p.toJSON()),
    });

    console.log(`[MSG] change_video → ${url} in room ${room.roomCode}`);
  });

  // ─── assign_role ───────────────────────────────────────────────────────────
  // Payload: { targetUserId, role }
  //
  // Host-only action. Promotes a participant to moderator or demotes back
  // to participant. The host themselves cannot be reassigned.
  socket.on('assign_role', ({ targetUserId, role }) => {
    const auth = getAuthorizedParticipant(false, true); // requireManage = true
    if (!auth) return;

    const { room } = auth;

    // Validate the requested role value
    if (!['moderator', 'participant'].includes(role)) {
      socket.emit('error', { message: 'Invalid role. Use "moderator" or "participant".' });
      return;
    }

    const target = room.getParticipant(targetUserId);
    if (!target) {
      socket.emit('error', { message: 'Target participant not found.' });
      return;
    }

    // Prevent reassigning the host role
    if (target.role === 'host') {
      socket.emit('error', { message: 'Cannot change the host\'s role.' });
      return;
    }

    // Apply the role change
    target.role = role;

    // Broadcast to EVERYONE so all participant lists update
    room.broadcast('role_assigned', {
      userId: targetUserId,
      role,
    });

    console.log(`[MSG] assign_role: ${targetUserId} → ${role} in room ${room.roomCode}`);
  });

  // ─── remove_participant ────────────────────────────────────────────────────
  // Payload: { targetUserId }
  //
  // Host-only action. Forcibly removes a user from the room.
  // We emit you_were_removed to the kicked user's socket, then remove them
  // from the room and notify everyone else.
  socket.on('remove_participant', ({ targetUserId }) => {
    const auth = getAuthorizedParticipant(false, true); // requireManage = true
    if (!auth) return;

    const { room } = auth;

    const target = room.getParticipant(targetUserId);
    if (!target) {
      socket.emit('error', { message: 'Target participant not found.' });
      return;
    }

    // Cannot remove the host (themselves)
    if (target.role === 'host') {
      socket.emit('error', { message: 'Cannot remove the host.' });
      return;
    }

    // Notify the kicked user directly via their stored socketId
    // 'you_were_removed' tells the client to redirect to the home page
    const targetSocket = target.socketId;
    socket.to(targetSocket).emit('you_were_removed');

    // Remove them from the room's participant Map
    room.removeParticipant(targetUserId);

    // Tell everyone remaining that the user left
    room.broadcast('participant_removed', { userId: targetUserId });

    console.log(`[MSG] remove_participant: ${targetUserId} from room ${room.roomCode}`);
  });

  // ─── chat_message ──────────────────────────────────────────────────────────
  // Payload: { message }
  //
  // Any participant (regardless of role) can send chat messages.
  // We attach userId, displayName, and a server-side timestamp to the
  // broadcast so clients don't have to trust client-generated timestamps.
  socket.on('chat_message', ({ message }) => {
    if (!socket.roomCode || !socket.userId) return;

    const room = getRoom(socket.roomCode);
    if (!room) return;

    const participant = room.getParticipant(socket.userId);
    if (!participant) return;

    // Trim and validate the message
    const trimmed = (message || '').trim();
    if (!trimmed || trimmed.length > 500) return; // ignore empty or too-long messages

    // Broadcast to EVERYONE in the room (including the sender so they see
    // their own message appear in the chat list consistently)
    room.broadcast('chat_message', {
      userId:      participant.userId,
      displayName: participant.displayName,
      message:     trimmed,
      timestamp:   Date.now(), // server timestamp — reliable and consistent
    });

    console.log(`[MSG] chat from ${participant.displayName} in room ${room.roomCode}`);
  });

  // ─── send_reaction ─────────────────────────────────────────────────────────
  // Payload: { reaction }
  // Broadcasts a floating reaction to everyone in the room without saving to chat history.
  socket.on('send_reaction', ({ reaction }) => {
    if (!socket.roomCode || !socket.userId) return;

    const room = getRoom(socket.roomCode);
    if (!room) return;

    const participant = room.getParticipant(socket.userId);
    if (!participant) return;

    room.broadcast('receive_reaction', {
      userId: participant.userId,
      displayName: participant.displayName,
      reaction,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9), // unique ID for animation
    });
  });

  // ─── typing_start ──────────────────────────────────────────────────────────
  socket.on('typing_start', () => {
    if (!socket.roomCode || !socket.userId) return;
    const room = getRoom(socket.roomCode);
    if (!room) return;
    const participant = room.getParticipant(socket.userId);
    if (!participant) return;

    // Broadcast to everyone else that this user is typing
    socket.to(socket.roomCode).emit('user_typing', {
      userId: participant.userId,
      displayName: participant.displayName,
    });
  });

  // ─── typing_stop ───────────────────────────────────────────────────────────
  socket.on('typing_stop', () => {
    if (!socket.roomCode || !socket.userId) return;
    const room = getRoom(socket.roomCode);
    if (!room) return;

    socket.to(socket.roomCode).emit('user_stopped_typing', {
      userId: socket.userId,
    });
  });

  // ─── request_sync ──────────────────────────────────────────────────────────
  // Payload: (none)
  //
  // A client sends this when they think they might be out of sync
  // (e.g. after a brief network blip or a tab becoming visible again).
  // The server responds ONLY to the requesting socket with the current
  // room state — no need to disturb other participants.
  socket.on('request_sync', () => {
    if (!socket.roomCode || !socket.userId) return;

    const room = getRoom(socket.roomCode);
    if (!room) return;

    // Emit the current state directly back to just this socket
    socket.emit('sync_state', {
      videoUrl:    room.videoUrl,
      playing:     room.videoState.playing,
      currentTime: room.getEffectiveCurrentTime(), // accounts for drift
      participants: Array.from(room.participants.values()).map(p => p.toJSON()),
    });

    console.log(`[MSG] request_sync from ${socket.userId} in room ${room.roomCode}`);
  });

  // ─── leave_room ────────────────────────────────────────────────────────────
  // Payload: (none)
  //
  // Explicitly called when the client navigates away from the room page.
  // We handle cleanup here AND in 'disconnect' (below) because some clients
  // close the tab without sending leave_room.
  socket.on('leave_room', () => {
    handleLeave(socket);
  });

  // ─── disconnect ────────────────────────────────────────────────────────────
  // Fired automatically by Socket.IO when the connection drops for any reason:
  // tab closed, network lost, browser crash, etc.
  //
  // reason — a string like 'transport close', 'server namespace disconnect', etc.
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.id} — ${reason}`);
    handleLeave(socket);
  });
}

// ─── handleLeave(socket) ─────────────────────────────────────────────────────
// Shared cleanup logic for both leave_room and disconnect.
//
// Steps:
//   1. Look up the room
//   2. Remove the participant
//   3. Broadcast user_left to remaining participants
//   4. If the room is now empty, delete it from memory + SQLite
//   5. If the host left, assign host role to the next participant
async function handleLeave(socket) {
  const { roomCode, userId } = socket;
  if (!roomCode || !userId) return; // socket was never fully joined

  const room = getRoom(roomCode);
  if (!room) return;

  const participant = room.getParticipant(userId);
  if (!participant) return;

  const displayName = participant.displayName;

  // Remove from the room's participant Map
  room.removeParticipant(userId);

  // Leave the Socket.IO room channel
  socket.leave(roomCode);

  console.log(`[MSG] "${displayName}" left room ${roomCode}`);

  // If room is now empty → clean it up entirely
  if (room.participants.size === 0) {
    await removeRoom(roomCode);
    return;
  }

  // If the leaving participant was the HOST, promote the next participant.
  // We pick the first remaining participant (arbitrary but deterministic).
  if (participant.role === 'host') {
    const nextParticipant = room.participants.values().next().value;
    nextParticipant.role = 'host';

    // Notify everyone about the new host
    room.broadcast('role_assigned', {
      userId: nextParticipant.userId,
      role:   'host',
    });

    console.log(`[MSG] Host transferred to "${nextParticipant.displayName}" in room ${roomCode}`);
  }

  // Notify remaining participants that this user left
  room.broadcast('user_left', { userId });
}
