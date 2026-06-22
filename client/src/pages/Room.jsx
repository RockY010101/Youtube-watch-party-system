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
import FloatingReactions from '../components/FloatingReactions.jsx';
import ToastNotifications from '../components/ToastNotifications.jsx';
import VideoQueue from '../components/VideoQueue.jsx';
import { useAudioChat } from '../hooks/useAudioChat.js';
import AudioStreams from '../components/AudioStreams.jsx';

export default function Room() {
  // ── Router hooks ────────────────────────────────────────────────────────
  const { code }       = useParams();          // the 6-char room code from the URL
  const location       = useLocation();        // to read location.state
  const navigate       = useNavigate();

  // ── Identity (passed from Home.jsx via location.state) ──────────────────
  const userId      = location.state?.userId;
  const displayName = location.state?.displayName;

  // ─── Room state ───────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState([]);
  const [myRole, setMyRole] = useState('participant');
  const [videoState, setVideoState] = useState({
    videoUrl: '',
    currentTime: 0,
    playing: false,
  });
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  // ─── Audio Chat Hook ───────────────────────────────────────────────────────
  const currentUser = participants.find(p => p.userId === userId);
  const {
    audioStreams,
    joinRequests,
    speakingUsers,
    toggleMute,
    toggleDeafen,
    requestVoice,
    leaveVoice,
    admitUser,
    denyUser,
    muteUser
  } = useAudioChat(code, currentUser, participants);

  // Filter participants for voice channel
  const voiceParticipants = participants.filter(p => p.voiceStatus === 'joined');
  const otherParticipants = participants.filter(p => p.voiceStatus !== 'joined');

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'members' | 'queue'
  const [codeCopied, setCodeCopied] = useState(false);

  // ── Queue state ───────────────────────────────────────────────────────────
  const [queue, setQueue] = useState([]);

  // ── Poll state ────────────────────────────────────────────────────────────
  const [poll, setPoll] = useState(null);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }, [code]);

  // ── Toast notifications ───────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', icon = '🔔', duration = 3800) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type, icon, duration }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Track previous video URL so we can detect changes
  const prevVideoUrlRef = useRef('');

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
      setQueue(room.queue ?? []);  // hydrate queue on join
      setPoll(room.poll ?? null);  // hydrate poll on join
      setConnected(true);
    }

    function onSyncState({ videoUrl, currentTime, playing, participants: updatedParticipants }) {
      // Fire a toast only when the video URL genuinely changes (not on the first sync)
      if (videoUrl && prevVideoUrlRef.current && videoUrl !== prevVideoUrlRef.current) {
        addToast('Video changed', 'video', '🎬');
      }
      if (videoUrl) prevVideoUrlRef.current = videoUrl;

      setVideoState({ videoUrl, currentTime, playing });
      if (updatedParticipants) setParticipants(updatedParticipants);
      if (playerRef.current) {
        playerRef.current.syncTo({ videoUrl, currentTime, playing });
      }
    }

    function onUserJoined({ participant }) {
      setParticipants(prev => {
        const exists = prev.find(p => p.userId === participant.userId);
        if (!exists) {
          addToast(`${participant.displayName} joined`, 'join', '👋');
        }
        return exists ? prev : [...prev, participant];
      });
    }

    function onUserLeft({ userId: leftId }) {
      setParticipants(prev => {
        const leaving = prev.find(p => p.userId === leftId);
        if (leaving) addToast(`${leaving.displayName} left`, 'leave', '🚶');
        return prev.filter(p => p.userId !== leftId);
      });
      setTypingUsers(prev => prev.filter(u => u.userId !== leftId));
    }

    function onRoleAssigned({ userId: targetId, role }) {
      setParticipants(prev => {
        const target = prev.find(p => p.userId === targetId);
        if (target) {
          if (role === 'host') {
            addToast(`${target.displayName} is now the Host`, 'role', '👑');
          } else if (role === 'moderator') {
            addToast(`${target.displayName} became a Moderator`, 'role', '🛡️');
          } else {
            addToast(`${target.displayName} is now a Viewer`, 'info', '👁️');
          }
        }
        return prev.map(p => p.userId === targetId ? { ...p, role } : p);
      });
      if (targetId === userId) setMyRole(role);
    }

    function onParticipantRemoved({ userId: removedId }) {
      setParticipants(prev => {
        const removed = prev.find(p => p.userId === removedId);
        if (removed && removedId !== userId) {
          addToast(`${removed.displayName} was removed`, 'warning', '🚫');
        }
        return prev.filter(p => p.userId !== removedId);
      });
      setTypingUsers(prev => prev.filter(u => u.userId !== removedId));
    }

    function onYouWereRemoved() {
      setError('You were removed from the room by the host.');
      socket.disconnect();
      setTimeout(() => navigate('/', { replace: true }), 3000);
    }

    function onChatMessage(msg) {
      setMessages(prev => [...prev, msg]);
      // If the user sent a message, they are no longer typing
      setTypingUsers(prev => prev.filter(u => u.userId !== msg.userId));
    }

    function onReceiveReaction(reactionObj) {
      setReactions(prev => [...prev, reactionObj]);
    }

    function onUserTyping({ userId: tUserId, displayName: tName }) {
      setTypingUsers(prev => {
        if (prev.find(u => u.userId === tUserId)) return prev;
        return [...prev, { userId: tUserId, displayName: tName }];
      });
    }

    function onUserStoppedTyping({ userId: sUserId }) {
      setTypingUsers(prev => prev.filter(u => u.userId !== sUserId));
    }

    function onError({ message }) {
      console.error('[Room] Server error:', message);
    }

    function onQueueUpdated({ queue: newQueue }) {
      setQueue(newQueue);
    }

    function onPollUpdated({ poll: newPoll }) {
      setPoll(newPoll);
    }

    function onParticipantUpdated({ participant }) {
      setParticipants(prev => prev.map(p => p.userId === participant.userId ? participant : p));
    }

    socket.on('joined_room',         onJoinedRoom);
    socket.on('sync_state',          onSyncState);
    socket.on('user_joined',         onUserJoined);
    socket.on('user_left',           onUserLeft);
    socket.on('role_assigned',       onRoleAssigned);
    socket.on('participant_removed', onParticipantRemoved);
    socket.on('participant_updated', onParticipantUpdated);
    socket.on('you_were_removed',    onYouWereRemoved);
    socket.on('chat_message',        onChatMessage);
    socket.on('receive_reaction',    onReceiveReaction);
    socket.on('user_typing',         onUserTyping);
    socket.on('user_stopped_typing', onUserStoppedTyping);
    socket.on('error',               onError);
    socket.on('queue_updated',       onQueueUpdated);
    socket.on('poll_updated',        onPollUpdated);

    return () => {
      socket.emit('leave_room', { code });
      socket.off('joined_room',         onJoinedRoom);
      socket.off('sync_state',          onSyncState);
      socket.off('user_joined',         onUserJoined);
      socket.off('user_left',           onUserLeft);
      socket.off('role_assigned',       onRoleAssigned);
      socket.off('participant_removed', onParticipantRemoved);
      socket.off('participant_updated', onParticipantUpdated);
      socket.off('you_were_removed',    onYouWereRemoved);
      socket.off('chat_message',        onChatMessage);
      socket.off('receive_reaction',    onReceiveReaction);
      socket.off('user_typing',         onUserTyping);
      socket.off('user_stopped_typing', onUserStoppedTyping);
      socket.off('error',               onError);
      socket.off('queue_updated',       onQueueUpdated);
      socket.off('poll_updated',        onPollUpdated);
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
  const emitSendReaction = useCallback((reaction) => socket.emit('send_reaction', { reaction }), []);
  const emitTypingStart = useCallback(() => socket.emit('typing_start'), []);
  const emitTypingStop = useCallback(() => socket.emit('typing_stop'), []);

  // ── Queue emit helpers (host-only on the server) ───────────────────────────
  const emitQueueAdd     = useCallback((url)                 => socket.emit('queue_add',     { url }),             []);
  const emitQueueRemove  = useCallback((id)                  => socket.emit('queue_remove',  { id }),              []);
  const emitQueueReorder = useCallback((fromIndex, toIndex)  => socket.emit('queue_reorder', { fromIndex, toIndex }), []);
  const emitQueueNext    = useCallback(()                    => socket.emit('queue_next'),                         []);

  // ── Poll emit helpers ─────────────────────────────────────────────────────
  const emitPollCreate   = useCallback((data)     => socket.emit('poll_create', data),       []);
  const emitPollVote     = useCallback((optionId) => socket.emit('poll_vote', { optionId }), []);
  const emitPollClose    = useCallback(()         => socket.emit('poll_close'),              []);

  // Auto-advance: when video ends and queue has items, play the next one.
  // Only the host fires this to avoid multiple clients racing.
  const handleVideoEnded = useCallback(() => {
    if (queue.length > 0) {
      emitQueueNext();
    }
  }, [queue, emitQueueNext]);

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
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="room-main">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="room-left-sidebar">
          
          <div className="left-room-code-box">
            <span className="left-room-code-label">Room Code</span>
            <div className="left-room-code-row">
              <span className="left-room-code-value">{code}</span>
              <button
                id="btn-copy-room-code"
                className={`btn-copy-code ${codeCopied ? 'copied' : ''}`}
                onClick={handleCopyCode}
                title="Copy room code"
              >
                {codeCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Voice Channel */}
          <div className="voice-channel-container">
            <div 
              className="voice-channel-header" 
              onClick={() => {
                if (currentUser?.voiceStatus === 'none') requestVoice();
                else if (currentUser?.voiceStatus === 'joined') leaveVoice();
              }}
              style={{ cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#43b581', fontWeight: 'bold' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 2v10.553c-1.332.327-2.332 1.547-2.332 3.018v.429c0 1.657 1.343 3 3 3s3-1.343 3-3v-.429c0-1.471-1-2.691-2.332-3.018v-4.553h3.332v1.895c0 .552.448 1 1 1s1-.448 1-1v-2.895c0-.552-.448-1-1-1h-5.668z"/>
              </svg>
              Lounge
            </div>

            {/* Render Voice Participants */}
            <div className="voice-participants" style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {voiceParticipants.map((p) => {
                const isMe = p.userId === userId;
                return (
                  <div key={p.userId} className="voice-participant-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '4px', background: isMe ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                    <div className="left-participant-avatar" style={{ width: '24px', height: '24px', fontSize: '12px', border: speakingUsers.has(p.userId) ? '2px solid #3ba55d' : '2px solid transparent', boxShadow: speakingUsers.has(p.userId) ? '0 0 5px #3ba55d' : 'none', boxSizing: 'border-box' }}>
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: isMe ? '#fff' : '#b9bbbe', flex: 1, fontSize: '14px' }}>{p.displayName}</span>
                    
                    {/* Audio Status Icons */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {!p.micOn && (
                        <span title="Muted" style={{ color: '#ed4245', fontSize: '14px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.78 4.37a5 5 0 0 1 10.44 0v6.26l-10.44-10.44zm-.78.78 12.85 12.85-1.41 1.41-2.82-2.82c-1.32.74-2.85 1.15-4.62 1.15-4.97 0-9-4.03-9-9h2c0 3.86 3.14 7 7 7 1.3 0 2.52-.35 3.58-.96l-3.58-3.58v2.54h-2v-4.3l-2-2v6.3h2v-2.54l-1.58-1.58A5 5 0 0 1 6 5.15z"/></svg>
                        </span>
                      )}
                      {p.deafened && (
                        <span title="Deafened" style={{ color: '#ed4245', fontSize: '14px' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.52 0 10 4.48 10 10v4.5c0 1.38-1.12 2.5-2.5 2.5h-1.5v-7h2A8 8 0 0 0 4 12h2v7H4.5C3.12 19 2 17.88 2 16.5V12c0-5.52 4.48-10 10-10zm-1.07 3.52 9.55 9.55-1.42 1.42-9.55-9.55 1.42-1.42z"/></svg>
                        </span>
                      )}

                      {/* Controls for host over others */}
                      {isHost && !isMe && p.micOn && (
                        <button onClick={() => muteUser(p.userId)} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer', padding: '0 4px' }} title="Force Mute">
                          🔇
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Join Requests for Host */}
          {isHost && joinRequests.length > 0 && (
            <div className="join-requests" style={{ margin: '10px 0', padding: '10px', background: '#2f3136', borderRadius: '4px' }}>
              <h4 style={{ margin: '0 0 10px', color: '#fff', fontSize: '12px', textTransform: 'uppercase' }}>Voice Requests</h4>
              {joinRequests.map(reqId => {
                const reqUser = participants.find(p => p.userId === reqId);
                if (!reqUser) return null;
                return (
                  <div key={reqId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#dcddde' }}>{reqUser.displayName}</span>
                    <div>
                      <button onClick={() => admitUser(reqId)} style={{ background: '#3ba55d', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}>✓</button>
                      <button onClick={() => denyUser(reqId)} style={{ background: '#ed4245', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="left-participants-header" style={{ marginTop: '20px' }}>
            <span className="left-participants-icon">👥</span>
            <span className="left-participants-title">Participants</span>
            <span className="left-participants-count">{otherParticipants.length} online</span>
          </div>

          {otherParticipants.map((p) => (
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
            <div className="left-identity-card" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="left-identity-avatar" style={{ border: speakingUsers.has(userId) ? '2px solid #3ba55d' : '2px solid transparent', boxShadow: speakingUsers.has(userId) ? '0 0 5px #3ba55d' : 'none', boxSizing: 'border-box' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="left-identity-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
                <div className="left-identity-sub">{myRoleLabel}</div>
              </div>
              
              {/* Local User Controls */}
              {currentUser?.voiceStatus === 'joined' && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={toggleMute} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: currentUser?.micOn ? '#b9bbbe' : '#ed4245', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} 
                    title="Toggle Mute"
                  >
                    {currentUser?.micOn ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.78 4.37a5 5 0 0 1 10.44 0v6.26l-10.44-10.44zm-.78.78 12.85 12.85-1.41 1.41-2.82-2.82c-1.32.74-2.85 1.15-4.62 1.15-4.97 0-9-4.03-9-9h2c0 3.86 3.14 7 7 7 1.3 0 2.52-.35 3.58-.96l-3.58-3.58v2.54h-2v-4.3l-2-2v6.3h2v-2.54l-1.58-1.58A5 5 0 0 1 6 5.15z"/></svg>
                    )}
                  </button>
                  <button 
                    onClick={toggleDeafen} 
                    style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: !currentUser?.deafened ? '#b9bbbe' : '#ed4245', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} 
                    title="Toggle Deafen"
                  >
                    {!currentUser?.deafened ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.52 0 10 4.48 10 10v4.5c0 1.38-1.12 2.5-2.5 2.5h-1.5v-7h2A8 8 0 0 0 4 12h2v7H4.5C3.12 19 2 17.88 2 16.5V12c0-5.52 4.48-10 10-10zm-1.07 3.52 9.55 9.55-1.42 1.42-9.55-9.55 1.42-1.42z"/></svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Hidden Audio Elements */}
        <AudioStreams audioStreams={audioStreams} localDeafened={currentUser?.deafened} />

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
              onEnded={isHost ? handleVideoEnded : undefined}
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
            <button
              className={`sidebar-tab ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Queue {queue.length > 0 && <span className="sidebar-tab-badge">{queue.length}</span>}
            </button>
          </div>

          <div className={`sidebar-panel ${activeTab === 'chat' ? 'active' : ''}`}>
            <Chat
              messages={messages}
              myUserId={userId}
              displayName={displayName}
              onSendMessage={emitChatMessage}
              onSendReaction={emitSendReaction}
              typingUsers={typingUsers}
              onTypingStart={emitTypingStart}
              onTypingStop={emitTypingStop}
              poll={poll}
              isHost={isHost}
              onPollCreate={emitPollCreate}
              onPollVote={emitPollVote}
              onPollClose={emitPollClose}
            />
            <FloatingReactions reactions={reactions} />
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

          <div className={`sidebar-panel ${activeTab === 'queue' ? 'active' : ''}`}>
            <VideoQueue
              queue={queue}
              isHost={isHost}
              onAdd={emitQueueAdd}
              onRemove={emitQueueRemove}
              onReorder={emitQueueReorder}
              onPlayNext={emitQueueNext}
            />
          </div>
        </aside>

      </main>
      <ToastNotifications toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}