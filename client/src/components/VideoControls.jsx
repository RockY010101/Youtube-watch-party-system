// VideoControls.jsx — Playback controls for the watch party
//
// This component renders:
//   1. A URL input — paste a YouTube link to change the video
//   2. Play / Pause button — toggles playback
//   3. A seek bar — scrub to any position in the video
//
// IMPORTANT: All buttons and inputs are DISABLED if canControl is false.
// This means participants (non-host, non-moderator) see the controls but
// cannot interact with them. Only host and moderator can control playback.
//
// Props:
//   canControl    — boolean: true if host or moderator
//   videoUrl      — string: current video URL (shown in the input)
//   playing       — boolean: current play state (determines Play vs Pause label)
//   onPlay        — function(): called when Play is clicked
//   onPause       — function(): called when Pause is clicked
//   onChangeVideo — function(url): called when a new URL is submitted

import { useState, useEffect } from 'react';

export default function VideoControls({
  canControl,
  videoUrl,
  playing,
  onPlay,
  onPause,
  onChangeVideo,
}) {
  // Local state for the URL input field
  // We keep it local so the input doesn't jump while the user is typing
  const [urlInput, setUrlInput] = useState(videoUrl || '');
  const [urlError, setUrlError] = useState('');

  // Keep input in sync if videoUrl changes from outside (e.g. server sync)
  useEffect(() => {
    setUrlInput(videoUrl || '');
  }, [videoUrl]);

  // ── handleUrlSubmit ────────────────────────────────────────────────────
  // Called when the user submits a new YouTube URL.
  // Basic validation before emitting to the server.
  function handleUrlSubmit(e) {
    e.preventDefault();
    setUrlError('');

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError('Please enter a YouTube URL.');
      return;
    }

    // Basic check — must look like a YouTube URL or an 11-char video ID
    const isYouTubeUrl = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    const isBareId     = /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

    if (!isYouTubeUrl && !isBareId) {
      setUrlError('Please enter a valid YouTube URL or video ID.');
      return;
    }

    onChangeVideo(trimmed);
  }

  // ── handlePlayPause ────────────────────────────────────────────────────
  // Toggles between play and pause.
  // Room.jsx passes onPlay/onPause which read the current player time
  // via playerRef before emitting to the server.
  function handlePlayPause() {
    if (playing) {
      onPause();
    } else {
      onPlay();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="video-controls">

      {/* ── URL input ─────────────────────────────────────────────────── */}
      <form className="url-form" onSubmit={handleUrlSubmit}>
        <input
          className="url-input"
          type="text"
          placeholder={
            canControl
              ? 'Paste a YouTube URL or video ID…'
              : 'Only the host/moderator can change the video'
          }
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          disabled={!canControl}
        />
        <button
          className="btn btn-change-video"
          type="submit"
          disabled={!canControl}
        >
          Load
        </button>
      </form>
      {urlError && <p className="control-error">{urlError}</p>}

      {/* ── Play / Pause button ───────────────────────────────────────── */}
      <div className="playback-buttons">
        <button
          className={`btn btn-playback ${playing ? 'btn-pause' : 'btn-play'}`}
          onClick={handlePlayPause}
          disabled={!canControl || !videoUrl}
          title={!canControl ? 'Only host/moderator can control playback' : ''}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Role indicator — tells participants why buttons are disabled */}
        {!canControl && (
          <span className="viewer-notice">
            👁 Viewer — only the host/moderator controls playback
          </span>
        )}
      </div>

    </div>
  );
}