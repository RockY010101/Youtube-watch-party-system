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

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="home-navbar">
        <div className="navbar-brand">
          <div className="navbar-logo-icon" />
          <div>
            <span className="navbar-brand-name">YouTube Watch Party</span>
            <span className="navbar-brand-sub">Watch YouTube videos together in real time.</span>
          </div>
        </div>

        <div className="navbar-links">
          <span className="navbar-link active">Home</span>
          <span className="navbar-link">Features</span>
          <span className="navbar-link">How it Works</span>
        </div>

        <div className="navbar-actions">
          <div className="navbar-icon-btn" title="Notifications">🔔</div>
          <div className="navbar-icon-btn" title="Settings">⚙️</div>
          <div className="navbar-avatar">Y</div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="home-hero">
        <h1 className="hero-title">
          Watch Together. <span className="gradient-text">Stay In Sync.</span>
        </h1>
        <p className="hero-sub">
          Experience YouTube like never before. Create private rooms, invite
          your friends, and watch your favorite creators in perfect real-time
          synchronization.
        </p>
      </div>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      <div className="home-cards">

        {/* Create Room card */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-icon">⊕</div>
            <h2 className="card-title">Start a Party</h2>
          </div>
          <form onSubmit={handleCreate} className="card-form">
            <div>
              <label className="form-label" htmlFor="create-name">Display Name</label>
              <input
                id="create-name"
                className="input"
                type="text"
                placeholder="Enter your name"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                maxLength={30}
                autoComplete="off"
              />
            </div>
            {createErr && <p className="form-error">{createErr}</p>}
            <button id="create-room-btn" className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </div>

        {/* Join Room card */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-icon">👥</div>
            <h2 className="card-title">Join a Friend</h2>
          </div>
          <form onSubmit={handleJoin} className="card-form">
            <div>
              <label className="form-label" htmlFor="join-code">Room Code</label>
              <input
                id="join-code"
                className="input input-mono"
                type="text"
                placeholder="X7Y-282"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="join-name">Display Name</label>
              <input
                id="join-name"
                className="input"
                type="text"
                placeholder="Enter your name"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                maxLength={30}
                autoComplete="off"
              />
            </div>
            {joinErr && <p className="form-error">{joinErr}</p>}
            <button id="join-room-btn" className="btn btn-secondary" type="submit" disabled={joining}>
              {joining ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>

      </div>

      {/* ── Features footer ────────────────────────────────────────────── */}
      <div className="home-features">
        <h2 className="home-features-title">Ultimate Viewing Tools</h2>
        <p className="home-features-sub">Engineered for low-latency interactions and seamless entertainment.</p>
      </div>

    </div>
  );
}
