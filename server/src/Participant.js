// Participant.js — Domain class representing a single user inside a watch party room
//
// Each time a user joins a room, one Participant instance is created and stored
// inside the Room's participants Map.  The instance lives in memory for as long
// as the user is connected (or until they are removed by the host).
//
// Role hierarchy (lowest → highest privilege):
//   participant  →  can only watch; no playback control
//   moderator    →  can control playback (play / pause / seek / change video)
//   host         →  full control: everything a moderator can do PLUS
//                   assign roles and remove other participants

export class Participant {
  // ─── Constructor ────────────────────────────────────────────────────────────
  // Called once per join.  All four arguments are required.
  //
  //   userId      — a UUID generated on the client (or server) before joining.
  //                 Stays the same even if the user's socket reconnects.
  //   displayName — the name the user typed in the join form (e.g. "Alice").
  //   role        — 'host' | 'moderator' | 'participant'
  //                 RoomManager always sets the first joiner to 'host' and
  //                 everyone else to 'participant'.
  //   socketId    — the current Socket.IO socket id (socket.id).
  //                 This changes on every reconnect, so MessageHandler keeps
  //                 it up-to-date whenever the user rejoins.
  constructor(userId, displayName, role, socketId) {
    this.userId      = userId;
    this.displayName = displayName;
    this.role        = role;        // 'host' | 'moderator' | 'participant'
    this.socketId    = socketId;
  }

  // ─── canControl() ────────────────────────────────────────────────────────────
  // Returns true if this participant is allowed to control playback.
  // Checked by MessageHandler before handling: play, pause, seek, change_video.
  //
  // Both host and moderator return true.
  // A plain 'participant' returns false → they can only watch.
  canControl() {
    return this.role === 'host' || this.role === 'moderator';
  }

  // ─── canManage() ─────────────────────────────────────────────────────────────
  // Returns true if this participant is allowed to manage the room.
  // Checked by MessageHandler before handling: assign_role, remove_participant.
  //
  // Only 'host' can manage — even a moderator cannot kick or promote others.
  canManage() {
    return this.role === 'host';
  }

  // ─── toJSON() ────────────────────────────────────────────────────────────────
  // Returns a plain object that is safe to send to the client.
  //
  // We intentionally EXCLUDE socketId here because:
  //   • Clients don't need it — they identify users by userId.
  //   • Exposing raw socket IDs is an unnecessary information leak.
  //
  // This object is embedded inside the sync_state, joined_room, and
  // user_joined payloads that the server broadcasts.
  toJSON() {
    return {
      userId:      this.userId,
      displayName: this.displayName,
      role:        this.role,
    };
  }
}
