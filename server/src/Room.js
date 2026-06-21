// Room.js — Domain class representing one active watch party room
//
// One Room instance lives in memory for every active room code.
// RoomManager owns a Map<roomCode, Room> and is the only place that
// creates or destroys Room instances.
//
// Responsibilities of this class:
//   • Track all participants (in a Map for O(1) lookup by userId)
//   • Track the current video URL and playback state
//   • Calculate the "effective" current time so late joiners stay in sync
//   • Provide a broadcast helper so event handlers don't need to import `io`

import { io } from './index.js';
// `io` is the Socket.IO server instance exported from index.js.
// We import it here so Room can emit events to an entire Socket.IO room
// (the Socket.IO concept of a "room" is separate from our Watch-Party Room —
//  we use the roomCode string as the Socket.IO room name).

export class Room {
  // ─── Constructor ─────────────────────────────────────────────────────────────
  // Called once by RoomManager.createRoom().
  //
  //   roomCode — 6-char uppercase alphanumeric string (e.g. "A3B9QZ")
  //   hostName — display name of the room creator (used only for logging)
  constructor(roomCode, hostName) {
    this.roomCode    = roomCode;
    this.hostName    = hostName; // kept for debugging / logging

    // videoUrl — the YouTube URL currently loaded in every player.
    // Starts empty; the host sets it via change_video or on room creation.
    this.videoUrl    = '';

    // videoState — the canonical playback state of the room.
    //
    //   playing     : boolean — is the video currently playing or paused?
    //   currentTime : number  — position in seconds at the moment of the last
    //                           play / pause / seek event (the "last sync point").
    //   lastSyncAt  : number  — Date.now() (ms) at the time of the last sync.
    //                           Used by getEffectiveCurrentTime() to compute
    //                           how far the video has progressed since then.
    this.videoState  = {
      playing:     false,
      currentTime: 0,
      lastSyncAt:  Date.now(),
    };

    // participants — Map<userId, Participant>
    // A Map is used instead of an array so we can look up, update, and delete
    // participants in O(1) by userId (no looping needed).
    this.participants = new Map();

    // queue — ordered list of upcoming videos.
    // Each item: { id: string, url: string, addedBy: string }
    // Only the host can mutate this list.
    this.queue = [];

    // poll — active poll state.
    // Structure: { id: string, question: string, options: [{ id, text, votes }], votedUsers: [userIds] }
    this.poll = null;
  }

  // ─── addParticipant(participant) ─────────────────────────────────────────────
  // Stores a Participant instance in the Map, keyed by their userId.
  // Called by RoomManager.joinRoom() after creating the Participant object.
  addParticipant(participant) {
    this.participants.set(participant.userId, participant);
  }

  // ─── removeParticipant(userId) ───────────────────────────────────────────────
  // Deletes a participant from the Map by userId.
  // Called when:
  //   • The user disconnects (socket 'disconnect' event in MessageHandler)
  //   • The host removes them explicitly (remove_participant event)
  removeParticipant(userId) {
    this.participants.delete(userId);
  }

  // ─── getParticipant(userId) ──────────────────────────────────────────────────
  // Returns the Participant instance for a given userId, or undefined if not found.
  // Used by MessageHandler to look up the sender before checking permissions.
  getParticipant(userId) {
    return this.participants.get(userId);
  }

  // ─── getEffectiveCurrentTime() ───────────────────────────────────────────────
  // The most important method for sync.
  //
  // PROBLEM: When a user joins mid-playback, the server's stored currentTime
  // is stale — it was recorded at the moment of the last play/seek event.
  // If the video has been playing for 15 more seconds since then, a naive
  // approach would put the new joiner 15 seconds behind everyone else.
  //
  // SOLUTION: If the video is currently PLAYING, we add the elapsed wall-clock
  // time (in seconds) to the stored currentTime:
  //
  //   effectiveTime = currentTime + (Date.now() - lastSyncAt) / 1000
  //
  // If the video is PAUSED, elapsed time doesn't matter — currentTime is exact.
  //
  // This is sent to clients via the sync_state event so their YouTube players
  // seek to the correct position instantly.
  getEffectiveCurrentTime() {
    if (this.videoState.playing) {
      const elapsedSeconds = (Date.now() - this.videoState.lastSyncAt) / 1000;
      return this.videoState.currentTime + elapsedSeconds;
    }
    return this.videoState.currentTime;
  }

  // ─── updateVideoState(patch) ─────────────────────────────────────────────────
  // Merges a partial state update into videoState and refreshes lastSyncAt.
  // Called by MessageHandler for play / pause / seek events.
  //
  // Example call from MessageHandler:
  //   room.updateVideoState({ playing: true, currentTime: 42.5 });
  //
  // We always reset lastSyncAt to Date.now() on every update so that
  // getEffectiveCurrentTime() always measures drift from the most recent event.
  updateVideoState(patch) {
    Object.assign(this.videoState, patch);
    this.videoState.lastSyncAt = Date.now();
  }

  // ─── Queue helpers ────────────────────────────────────────────────────────────

  // addToQueue({ id, url, addedBy }) — appends one item to the end of the queue.
  addToQueue(item) {
    this.queue.push(item);
  }

  // removeFromQueue(id) — removes the item with the given id.
  removeFromQueue(id) {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  // reorderQueue(fromIndex, toIndex) — moves one item to a new position.
  reorderQueue(fromIndex, toIndex) {
    const len = this.queue.length;
    if (
      fromIndex < 0 || fromIndex >= len ||
      toIndex   < 0 || toIndex   >= len ||
      fromIndex === toIndex
    ) return;
    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);
  }

  // shiftQueue() — removes and returns the first item in the queue ("play next").
  // Returns undefined if the queue is empty.
  shiftQueue() {
    return this.queue.shift();
  }

  // ─── broadcast(event, payload, excludeSocketId) ───────────────────────────────
  // Emits a Socket.IO event to EVERY socket in this room.
  //
  //   event           — the event name (e.g. 'sync_state', 'user_joined')
  //   payload         — the data object to send
  //   excludeSocketId — (optional) if provided, that socket is skipped.
  //                     Used so the sender doesn't receive their own action
  //                     echoed back (e.g. the host doesn't need to seek
  //                     themselves — they already did it locally).
  //
  // Socket.IO "rooms":
  //   io.to(roomCode) targets every socket that has called socket.join(roomCode).
  //   MessageHandler calls socket.join(roomCode) during the join_room event.
  broadcast(event, payload, excludeSocketId = null) {
    if (excludeSocketId) {
      // Broadcast to everyone in the Socket.IO room EXCEPT the excluded socket
      io.to(this.roomCode).except(excludeSocketId).emit(event, payload);
    } else {
      // Broadcast to absolutely everyone in the room (including the sender)
      io.to(this.roomCode).emit(event, payload);
    }
  }

  // ─── toJSON() ────────────────────────────────────────────────────────────────
  // Returns a serializable snapshot of the room's current state.
  // Sent to the client as part of the joined_room and sync_state events.
  //
  // participants is converted from a Map to an array of plain objects using
  // each Participant's own toJSON() method (which strips the socketId).
  toJSON() {
    return {
      roomCode:    this.roomCode,
      videoUrl:    this.videoUrl,
      videoState: {
        playing:     this.videoState.playing,
        currentTime: this.getEffectiveCurrentTime(), // always accurate
        lastSyncAt:  this.videoState.lastSyncAt,
      },
      participants: Array.from(this.participants.values()).map(p => p.toJSON()),
      queue:        this.queue.slice(), // send a copy so callers can't mutate
      poll:         this.poll,
    };
  }
}
