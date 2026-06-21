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

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Navbar from '../components/Navbar.jsx';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ── Ember Particle Canvas ──────────────────────────────────────────────────
function EmberCanvas() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    const NUM_EMBERS = 55;

    function randomEmber(forceBottom = false) {
      const side = Math.random();
      let x;
      if (side < 0.3) {
        // left cluster
        x = Math.random() * W * 0.22;
      } else if (side > 0.7) {
        // right cluster
        x = W - Math.random() * W * 0.22;
      } else {
        // scattered center
        x = W * 0.15 + Math.random() * W * 0.7;
      }
      return {
        x,
        y: forceBottom ? H + Math.random() * 80 : Math.random() * H,
        size: 0.8 + Math.random() * 2.4,
        speedY: 0.25 + Math.random() * 0.7,
        speedX: (Math.random() - 0.5) * 0.35,
        opacity: 0.3 + Math.random() * 0.7,
        opacityDir: Math.random() < 0.5 ? 1 : -1,
        opacitySpeed: 0.004 + Math.random() * 0.008,
        hue: 0 + Math.random() * 25, // 0–25° → deep red to orange-red
      };
    }

    const embers = Array.from({ length: NUM_EMBERS }, () => randomEmber(false));

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (const e of embers) {
        // Flicker opacity
        e.opacity += e.opacitySpeed * e.opacityDir;
        if (e.opacity > 1)   { e.opacity = 1;   e.opacityDir = -1; }
        if (e.opacity < 0.15){ e.opacity = 0.15; e.opacityDir =  1; }

        // Move up + slight drift
        e.y -= e.speedY;
        e.x += e.speedX;

        // Recycle when off-screen top
        if (e.y < -10) Object.assign(e, randomEmber(true));

        // Glow
        const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3.5);
        glow.addColorStop(0, `hsla(${e.hue}, 100%, 65%, ${e.opacity})`);
        glow.addColorStop(1, `hsla(${e.hue}, 100%, 40%, 0)`);

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${e.hue}, 100%, 90%, ${e.opacity})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width  = W;
      canvas.height = H;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="ember-canvas" aria-hidden="true" />;
}

// ── Home Component ─────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();

  // ── Create Room state ──────────────────────────────────────────────────────────
  const [createName, setCreateName]   = useState('');
  const [creating,   setCreating]     = useState(false);
  const [createErr,  setCreateErr]    = useState('');

  // ── Join Room state ────────────────────────────────────────────────────────────
  const [joinCode,   setJoinCode]     = useState('');
  const [joinName,   setJoinName]     = useState('');
  const [joining,    setJoining]      = useState(false);
  const [joinErr,    setJoinErr]      = useState('');

  // ── Parallax ──────────────────────────────────────────────────────────────────
  const heroRef   = useRef(null);
  const glowRef   = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      if (glowRef.current) {
        glowRef.current.style.transform = `translateY(${scrollY * 0.18}px) scale(${1 + scrollY * 0.0002})`;
      }
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${scrollY * 0.06}px)`;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── handleCreate ──────────────────────────────────────────────────────────────
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

  // ── handleJoin ────────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="home-page">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="home-hero" ref={heroRef} aria-label="Hero">

        {/* Ember particles */}
        <EmberCanvas />

        {/* Smoky side vignettes */}
        <div className="hero-smoke hero-smoke-left"  aria-hidden="true" />
        <div className="hero-smoke hero-smoke-right" aria-hidden="true" />

        {/* Central red radial glow */}
        <div className="hero-glow" ref={glowRef} aria-hidden="true" />

        {/* Hero content */}
        <div className="hero-content" ref={contentRef}>
          <h1 className="hero-title">
            WATCH TOGETHER.<br />
            <span className="hero-title-accent">STAY IN SYNC.</span>
          </h1>

          <p className="hero-sub">
            Create private rooms, invite your friends, and watch YouTube videos
            in perfect real-time synchronization.
          </p>

          <p className="hero-statement" aria-label="Supporting statement">
            No countdowns.<br />
            No guessing.<br />
            <span className="hero-statement-accent">Just watch together.</span>
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="hero-scroll-indicator" aria-label="Scroll to get started">
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          <span className="scroll-label">SCROLL TO GET STARTED</span>
          <div className="scroll-chevron" aria-hidden="true">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path d="M1 1L8 8L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

      </section>

      {/* ── Cards ──────────────────────────────────────────────────────── */}
      <div className="home-cards">

        {/* Create Room card */}
        <div className="card card-create">
          <div className="card-header">
            <div className="card-header-icon card-icon-create">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
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
        <div className="card card-join">
          <div className="card-header">
            <div className="card-header-icon card-icon-join">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
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

      {/* ── Features footer ─────────────────────────────────────────────── */}
      <div className="home-features">
        <h2 className="home-features-title">Ultimate Viewing Tools</h2>
        <p className="home-features-sub">Engineered for low-latency interactions and seamless entertainment.</p>
      </div>

    </div>
  );
}
