// Home.jsx — Create or Join a watch party room
//
// Two forms on one page:
//   1. Create Room — user enters their display name → POST /api/room
//                    server returns { code, userId } → navigate to /room/:code
//   2. Join Room   — user enters room code + name → GET /api/room/:code to verify
//                    if exists → navigate to /room/:code
//
// On success, we pass { userId, displayName } via React Router location.state
// so Room.jsx can read them without needing a global store or URL params.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function Home() {
  const navigate = useNavigate();

  // ── Create Room state ──────────────────────────────────────────────────────
  const [createName, setCreateName]   = useState('');
  const [creating,   setCreating]     = useState(false);
  const [createErr,  setCreateErr]    = useState('');

  // ── Join Room state ────────────────────────────────────────────────────────
  const [joinCode,   setJoinCode]     = useState('');
  const [joinName,   setJoinName]     = useState('');
  const [joining,    setJoining]      = useState(false);
  const [joinErr,    setJoinErr]      = useState('');

  // ── handleCreate ──────────────────────────────────────────────────────────
  // Called when the Create Room form is submitted.
  // Hits POST /api/room, gets back { code, userId }, then navigates.
  async function handleCreate(e) {
    e.preventDefault();
    setCreateErr('');
    const name = createName.trim();
    if (!name) { setCreateErr('Please enter your display name.'); return; }

    setCreating(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/room`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ displayName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room.');

      // Navigate to /room/:code and pass identity via location.state
      navigate(`/room/${data.code}`, {
        state: { userId: data.userId, displayName: name },
      });
    } catch (err) {
      setCreateErr(err.message);
    } finally {
      setCreating(false);
    }
  }

  // ── handleJoin ────────────────────────────────────────────────────────────
  // Called when the Join Room form is submitted.
  // Hits GET /api/room/:code first to validate, then navigates.
  async function handleJoin(e) {
    e.preventDefault();
    setJoinErr('');
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    if (!code) { setJoinErr('Please enter a room code.'); return; }
    if (!name) { setJoinErr('Please enter your display name.'); return; }

    setJoining(true);
    try {
      const res  = await fetch(`${SERVER_URL}/api/room/${code}`);
      const data = await res.json();
      if (!data.exists) throw new Error(`Room "${code}" not found.`);

      // Generate a userId client-side for joiners (host userId comes from server)
      const userId = uuidv4();
      navigate(`/room/${code}`, {
        state: { userId, displayName: name },
      });
    } catch (err) {
      setJoinErr(err.message);
    } finally {
      setJoining(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="home-page">
      {/* Hero */}
      <div className="home-hero">
        <div className="hero-badge">🎬 Real-time sync</div>
        <h1 className="hero-title">Watch YouTube<br /><span className="gradient-text">Together</span></h1>
        <p className="hero-sub">Create a room, share the code, and enjoy perfectly synced playback with anyone on the planet.</p>
      </div>

      {/* Cards */}
      <div className="home-cards">

        {/* Create Room card */}
        <div className="card">
          <div className="card-icon">✨</div>
          <h2 className="card-title">Create a Room</h2>
          <p className="card-desc">Start a new watch party and invite friends with a 6-character code.</p>
          <form onSubmit={handleCreate} className="card-form">
            <input
              id="create-name"
              className="input"
              type="text"
              placeholder="Your display name"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
            {createErr && <p className="form-error">{createErr}</p>}
            <button id="create-room-btn" className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="home-divider"><span>or</span></div>

        {/* Join Room card */}
        <div className="card">
          <div className="card-icon">🔗</div>
          <h2 className="card-title">Join a Room</h2>
          <p className="card-desc">Got a code from a friend? Enter it below to jump right in.</p>
          <form onSubmit={handleJoin} className="card-form">
            <input
              id="join-code"
              className="input input-mono"
              type="text"
              placeholder="Room code (e.g. A3B9QZ)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
            />
            <input
              id="join-name"
              className="input"
              type="text"
              placeholder="Your display name"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              maxLength={30}
              autoComplete="off"
            />
            {joinErr && <p className="form-error">{joinErr}</p>}
            <button id="join-room-btn" className="btn btn-secondary" type="submit" disabled={joining}>
              {joining ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
