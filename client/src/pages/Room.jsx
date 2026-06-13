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
  const userId      = location.state?.userId;
  const displayName = location.state?.displayName;

  // ── Room state ───────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [myRole, setMyRole] = useState('participant');
  const [videoState, setVideoState] = useState({
    videoUrl: '',
    currentTime: 0,
    playing: false,
  });
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'members'

  // ── Ref to the YouTube player's imperative API ───────────────────────────
  const playerRef = useRef(null);

  // ── Guard: redirect if no identity ──────────────────────────────────────
  useEffect(() => {
    if (!userId || !displayName) {
      navigate('/', { replace: true });
    }
  }, [userId, displayName, navigate]);

  // ── Socket connection + event listeners ─────────────────────────────────
  useEffect(() => {
    if (!userId || !displayName) return;

    socket.connect();
    socket.emit('join_room', { code, userId, displayName });

    function onJoinedRoom({ room, you }) {
      setParticipants(room.participants);
      setMyRole(you.role);
      setVideoState(room.videoState);
      setConnected(true);
    }

    function onSyncState({ videoUrl, currentTime, playing, participants: updatedParticipants }) {
      setVideoState({ videoUrl, currentTime, playing });
      if (updatedParticipants) setParticipants(updatedParticipants);
      if (playerRef.current) {
        playerRef.current.syncTo({ videoUrl, currentTime, playing });
      }
    }

    function onUserJoined({ participant }) {
      setParticipants(prev => {
        const exists = prev.find(p => p.userId === participant.userId);
        return exists ? prev : [...prev, participant];
      });
    }

    function onUserLeft({ userId: leftId }) {
      setParticipants(prev => prev.filter(p => p.userId !== leftId));
    }

    function onRoleAssigned({ userId: targetId, role }) {
      setParticipants(prev =>
        prev.map(p => p.userId === targetId ? { ...p, role } : p)
      );
      if (targetId === userId) setMyRole(role);
    }

    function onParticipantRemoved({ userId: removedId }) {
      setParticipants(prev => prev.filter(p => p.userId !== removedId));
    }

    function onYouWereRemoved() {
      setError('You were removed from the room by the host.');
      socket.disconnect();
      setTimeout(() => navigate('/', { replace: true }), 3000);
    }

    function onChatMessage(msg) {
      setMessages(prev => [...prev, msg]);
    }

    function onError({ message }) {
      console.error('[Room] Server error:', message);
    }

    socket.on('joined_room',         onJoinedRoom);
    socket.on('sync_state',          onSyncState);
    socket.on('user_joined',         onUserJoined);
    socket.on('user_left',           onUserLeft);
    socket.on('role_assigned',       onRoleAssigned);
    socket.on('participant_removed', onParticipantRemoved);
    socket.on('you_were_removed',    onYouWereRemoved);
    socket.on('chat_message',        onChatMessage);
    socket.on('error',               onError);

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
  }, [code, userId, displayName]);

  // ── Emit helpers (passed as props to children) ───────────────────────────
  const emitPlay = useCallback((currentTime) => socket.emit('play', { currentTime }), []);
  const emitPause = useCallback((currentTime) => socket.emit('pause', { currentTime }), []);
  const emitSeek = useCallback((currentTime) => socket.emit('seek', { currentTime }), []);
  const emitChangeVideo = useCallback((url) => socket.emit('change_video', { url }), []);
  const emitAssignRole = useCallback((targetUserId, role) => socket.emit('assign_role', { targetUserId, role }), []);
  const emitRemoveParticipant = useCallback((targetUserId) => socket.emit('remove_participant', { targetUserId }), []);
  const emitChatMessage = useCallback((message) => socket.emit('chat_message', { message }), []);

  const handlePlay = useCallback(async () => {
    const t = await playerRef.current?.getCurrentTime() ?? 0;
    emitPlay(t);
  }, [emitPlay]);

  const handlePause = useCallback(async () => {
    const t = await playerRef.current?.getCurrentTime() ?? 0;
    emitPause(t);
  }, [emitPause]);

  const getPlayerTime = useCallback(async () => {
    if (!playerRef.current) return { time: 0, duration: 0 };
    const t = await playerRef.current.getCurrentTime();
    const d = await playerRef.current.getDuration();
    return { time: t, duration: d };
  }, []);

  const canControl = myRole === 'host' || myRole === 'moderator';
  const isHost     = myRole === 'host';

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div className="room-loading">
        <div className="loading-spinner" />
        <p>Connecting to room <strong>{code}</strong>…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-error">
        <p>{error}</p>
        <p className="room-error-sub">Redirecting you home…</p>
      </div>
    );
  }

  // Helper for your identity label
  const myRoleLabel = myRole === 'host' ? 'Host' : (myRole === 'moderator' ? 'Moderator' : 'Viewer');

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="room-layout">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="room-header">
        <div className="room-header-left">
          <div className="room-logo-wrap">
            <div className="room-logo-icon" />
            <span className="room-title">Watch Party</span>
            <span className="live-sync-badge">Live Sync</span>
          </div>
        </div>
        <div className="room-header-center">
          {/* Empty center in new design */}
        </div>
        <div className="room-header-right">
          <div className="room-header-icon-btn" title="Notifications">🔔</div>
          <div className="room-header-icon-btn" title="Settings">⚙️</div>
          <div className="room-header-avatar">{displayName.charAt(0).toUpperCase()}</div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="room-main">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="room-left-sidebar">
          
          <div className="left-room-code-box">
            <span className="left-room-code-label">Room Code</span>
            <span className="left-room-code-value">{code}</span>
          </div>

          <div className="left-participants-header">
            <span className="left-participants-icon">👥</span>
            <span className="left-participants-title">Participants</span>
            <span className="left-participants-count">{participants.length} online</span>
          </div>

          {participants.map((p) => (
            <div key={p.userId} className="left-participant-item">
              <div className={`left-participant-avatar ${p.role === 'host' ? 'is-host' : ''}`}>
                {p.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="left-participant-info">
                <span className="left-participant-name">{p.displayName}</span>
                {p.role !== 'participant' && (
                  <span className={`left-participant-role role-${p.role}`}>
                    {p.role}
                  </span>
                )}
              </div>
            </div>
          ))}

          <div className="left-your-identity">
            <span className="left-identity-label">Your Identity</span>
            <div className="left-identity-card">
              <div className="left-identity-avatar">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="left-identity-name">{displayName}</div>
                <div className="left-identity-sub">{myRoleLabel}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── CENTER: Video + Controls ─────────────────────────────────── */}
        <section className="room-player-section">
          <div className="player-wrapper">
            <YoutubePlayer
              ref={playerRef}
              videoUrl={videoState.videoUrl}
              canControl={canControl}
              onPlay={emitPlay}
              onPause={emitPause}
              onSeek={emitSeek}
            />
          </div>
          <VideoControls
            canControl={canControl}
            videoUrl={videoState.videoUrl}
            playing={videoState.playing}
            onPlay={handlePlay}
            onPause={handlePause}
            onChangeVideo={emitChangeVideo}
            getPlayerTime={getPlayerTime}
          />
        </section>

        {/* ── RIGHT SIDEBAR: Chat / Members Tabs ───────────────────────── */}
        <aside className="room-sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Live Chat
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
          </div>

          <div className={`sidebar-panel ${activeTab === 'chat' ? 'active' : ''}`}>
            <Chat
              messages={messages}
              myUserId={userId}
              displayName={displayName}
              onSendMessage={emitChatMessage}
            />
          </div>

          <div className={`sidebar-panel ${activeTab === 'members' ? 'active' : ''}`}>
            <ParticipantList
              participants={participants}
              myUserId={userId}
              isHost={isHost}
              onAssignRole={emitAssignRole}
              onRemoveParticipant={emitRemoveParticipant}
            />
          </div>
        </aside>

      </main>
    </div>
  );
}