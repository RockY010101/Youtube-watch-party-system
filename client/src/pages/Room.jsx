// Room.jsx — The main watch party page
//
// This component is the "brain" of the entire app. It:
//   1. Reads userId + displayName from React Router location.state (passed by Home.jsx)
//   2. Connects the socket and emits join_room
//   3. Registers ALL incoming socket event listeners
//   4. Holds ALL shared state: participants, videoState, chat messages, your role
//   5. Passes state + emit functions DOWN to child components as props
//
// WHY manage state here and not in children?
// Because multiple children need the same data. E.g. ParticipantList AND
// VideoControls both need to know your role. Keeping state here (one source
// of truth) and passing it down avoids sync bugs.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import socket from '../socket.js';
import YoutubePlayer from '../components/YoutubePlayer.jsx';
import VideoControls from '../components/VideoControls.jsx';
import ParticipantList from '../components/ParticipantList.jsx';
import Chat from '../components/Chat.jsx';

export default function Room() {
  // ── Router hooks ────────────────────────────────────────────────────────
  const { code }       = useParams();          // the 6-char room code from the URL
  const location       = useLocation();        // to read location.state
  const navigate       = useNavigate();

  // ── Identity (passed from Home.jsx via location.state) ──────────────────
  // If someone navigates directly to /room/XXXX without going through Home,
  // location.state will be null — we redirect them back to Home.
  const userId      = location.state?.userId;
  const displayName = location.state?.displayName;

  // ── Room state ───────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  // participants: array of { userId, displayName, role }

  const [myRole, setMyRole] = useState('participant');
  // myRole: 'host' | 'moderator' | 'participant'
  // Derived from participants list, updated whenever role_assigned fires.

  const [videoState, setVideoState] = useState({
    videoUrl: '',          // full YouTube URL or video ID
    currentTime: 0,
    playing: false,
  });

  const [messages, setMessages] = useState([]);
  // messages: array of { userId, displayName, message, timestamp }

  const [error, setError] = useState('');
  // error: shown as a banner if something goes wrong (e.g. removed from room)

  const [connected, setConnected] = useState(false);
  // connected: true once joined_room fires — prevents rendering the UI too early

  // ── Ref to the YouTube player's imperative API ───────────────────────────
  // YoutubePlayer exposes { seekTo, play, pause, getCurrentTime } via a ref.
  // We use a ref (not state) because we don't want re-renders when it changes.
  const playerRef = useRef(null);

  // ── Guard: redirect if no identity ──────────────────────────────────────
  useEffect(() => {
    if (!userId || !displayName) {
      navigate('/', { replace: true });
    }
  }, [userId, displayName, navigate]);

  // ── Socket connection + event listeners ─────────────────────────────────
  useEffect(() => {
    if (!userId || !displayName) return; // don't connect if identity is missing

    // 1. Connect the socket (autoConnect was false, so we do it explicitly)
    socket.connect();

    // 2. Tell the server we're joining this room
    //    The server will respond with joined_room (if successful) or error.
    socket.emit('join_room', {
      code,           // the 6-char room code
      userId,         // our identity
      displayName,
    });

    // ── Incoming event handlers ──────────────────────────────────────────

    // joined_room: fired once, only to us, when we successfully join.
    // Contains the full current room state so we can hydrate our UI.
    // Payload: { room: { code, participants, videoState }, you: { userId, role } }
    function onJoinedRoom({ room, you }) {
      setParticipants(room.participants);
      setMyRole(you.role);
      setVideoState(room.videoState);   // sync to current video state immediately
      setConnected(true);
    }

    // sync_state: fired whenever the host/moderator plays, pauses, seeks, or
    // changes the video. ALL clients receive this and must update their player.
    // Payload: { videoUrl, currentTime, playing, participants }
    function onSyncState({ videoUrl, currentTime, playing, participants: updatedParticipants }) {
      // Update React state (used by VideoControls to show current URL)
      setVideoState({ videoUrl, currentTime, playing });

      // Also update participants list if included (e.g. after change_video)
      if (updatedParticipants) setParticipants(updatedParticipants);

      // Tell the YouTube player to actually seek/play/pause
      // playerRef.current is the imperative API exposed by YoutubePlayer
      if (playerRef.current) {
        playerRef.current.syncTo({ videoUrl, currentTime, playing });
      }
    }

    // user_joined: someone new joined the room
    // Payload: { participant: { userId, displayName, role } }
    function onUserJoined({ participant }) {
      setParticipants(prev => {
        // Avoid duplicates (socket can sometimes fire twice on reconnect)
        const exists = prev.find(p => p.userId === participant.userId);
        return exists ? prev : [...prev, participant];
      });
    }

    // user_left: someone disconnected or left
    // Payload: { userId }
    function onUserLeft({ userId: leftId }) {
      setParticipants(prev => prev.filter(p => p.userId !== leftId));
    }

    // role_assigned: a role was changed by the host
    // Payload: { userId, role }
    // We update the participants list AND update myRole if it's us.
    function onRoleAssigned({ userId: targetId, role }) {
      setParticipants(prev =>
        prev.map(p => p.userId === targetId ? { ...p, role } : p)
      );
      if (targetId === userId) {
        setMyRole(role);
      }
    }

    // participant_removed: the host kicked someone
    // Payload: { userId }
    function onParticipantRemoved({ userId: removedId }) {
      setParticipants(prev => prev.filter(p => p.userId !== removedId));
    }

    // you_were_removed: WE were kicked by the host
    // Payload: (empty)
    function onYouWereRemoved() {
      setError('You were removed from the room by the host.');
      socket.disconnect();
      // Redirect to home after a short delay so the user can read the message
      setTimeout(() => navigate('/', { replace: true }), 3000);
    }

    // chat_message: a new chat message from any participant (including us,
    // since the server echoes back to everyone including the sender)
    // Payload: { userId, displayName, message, timestamp }
    function onChatMessage(msg) {
      setMessages(prev => [...prev, msg]);
    }

    // error: server rejected something (e.g. permission denied)
    // Payload: { message }
    function onError({ message }) {
      console.error('[Room] Server error:', message);
      // You could show a toast here; for now we just log it
    }

    // 3. Register all listeners
    socket.on('joined_room',         onJoinedRoom);
    socket.on('sync_state',          onSyncState);
    socket.on('user_joined',         onUserJoined);
    socket.on('user_left',           onUserLeft);
    socket.on('role_assigned',       onRoleAssigned);
    socket.on('participant_removed', onParticipantRemoved);
    socket.on('you_were_removed',    onYouWereRemoved);
    socket.on('chat_message',        onChatMessage);
    socket.on('error',               onError);

    // 4. Cleanup: runs when the component unmounts (user navigates away)
    //    Remove all listeners and disconnect the socket cleanly.
    return () => {
      socket.emit('leave_room', { code });
      socket.off('joined_room',         onJoinedRoom);
      socket.off('sync_state',          onSyncState);
      socket.off('user_joined',         onUserJoined);
      socket.off('user_left',           onUserLeft);
      socket.off('role_assigned',       onRoleAssigned);
      socket.off('participant_removed', onParticipantRemoved);
      socket.off('you_were_removed',    onYouWereRemoved);
      socket.off('chat_message',        onChatMessage);
      socket.off('error',               onError);
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, userId, displayName]); // only re-run if these change (they won't)

  // ── Emit helpers (passed as props to children) ───────────────────────────
  // useCallback prevents new function references on every render,
  // which would cause unnecessary re-renders in child components.

  // ── Raw socket emitters ──────────────────────────────────────────────────
  const emitPlay = useCallback((currentTime) => {
    socket.emit('play', { currentTime });
  }, []);

  const emitPause = useCallback((currentTime) => {
    socket.emit('pause', { currentTime });
  }, []);

  const emitSeek = useCallback((currentTime) => {
    socket.emit('seek', { currentTime });
  }, []);

  const emitChangeVideo = useCallback((url) => {
    socket.emit('change_video', { url });
  }, []);

  const emitAssignRole = useCallback((targetUserId, role) => {
    socket.emit('assign_role', { targetUserId, role });
  }, []);

  const emitRemoveParticipant = useCallback((targetUserId) => {
    socket.emit('remove_participant', { targetUserId });
  }, []);

  const emitChatMessage = useCallback((message) => {
    socket.emit('chat_message', { message });
  }, []);

  // ── BUG FIX (Bug 1 + 3): Player-aware play/pause handlers ───────────────
  // VideoControls calls onPlay()/onPause() with NO arguments.
  // We must read currentTime from the player BEFORE emitting to the server,
  // otherwise the server receives undefined as the timestamp.
  // These async handlers are passed to VideoControls instead of emitPlay/emitPause.
  const handlePlay = useCallback(async () => {
    const t = await playerRef.current?.getCurrentTime() ?? 0;
    emitPlay(t);
  }, [emitPlay]);

  const handlePause = useCallback(async () => {
    const t = await playerRef.current?.getCurrentTime() ?? 0;
    emitPause(t);
  }, [emitPause]);

  // ── canControl: derived from myRole ─────────────────────────────────────
  // True if the current user is allowed to control playback.
  // Passed to VideoControls to enable/disable buttons.
  const canControl = myRole === 'host' || myRole === 'moderator';
  const isHost     = myRole === 'host';

  // ── Loading state ────────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="room-loading">
        <div className="loading-spinner" />
        <p>Connecting to room <strong>{code}</strong>…</p>
      </div>
    );
  }

  // ── Error state (e.g. removed from room) ────────────────────────────────
  if (error) {
    return (
      <div className="room-error">
        <p>{error}</p>
        <p className="room-error-sub">Redirecting you home…</p>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="room-layout">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="room-logo">🎬</span>
          <span className="room-title">Watch Party</span>
        </div>
        <div className="room-header-center">
          <span className="room-code-label">Room Code</span>
          <span className="room-code">{code}</span>
          <button
            className="btn-copy"
            onClick={() => navigator.clipboard.writeText(code)}
            title="Copy room code"
          >
            📋
          </button>
        </div>
        <div className="room-header-right">
          <span className="role-badge" data-role={myRole}>{myRole}</span>
          <span className="room-username">{displayName}</span>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="room-main">

        {/* Left: video + controls */}
        <section className="room-player-section">
          <YoutubePlayer
            ref={playerRef}
            videoUrl={videoState.videoUrl}
            canControl={canControl}
            onPlay={emitPlay}
            onPause={emitPause}
            onSeek={emitSeek}
          />
          <VideoControls
            canControl={canControl}
            videoUrl={videoState.videoUrl}
            playing={videoState.playing}
            onPlay={handlePlay}
            onPause={handlePause}
            onChangeVideo={emitChangeVideo}
          />
        </section>

        {/* Right: participants + chat */}
        <aside className="room-sidebar">
          <ParticipantList
            participants={participants}
            myUserId={userId}
            isHost={isHost}
            onAssignRole={emitAssignRole}
            onRemoveParticipant={emitRemoveParticipant}
          />
          <Chat
            messages={messages}
            myUserId={userId}
            displayName={displayName}
            onSendMessage={emitChatMessage}
          />
        </aside>

      </main>
    </div>
  );
}