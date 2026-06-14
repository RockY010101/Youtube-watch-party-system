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
  getPlayerTime,
}) {
  const [urlInput, setUrlInput] = useState(videoUrl || '');
  const [urlError, setUrlError] = useState('');
  const [progress, setProgress] = useState(0);
  const [timeStr, setTimeStr] = useState('00:00');

  useEffect(() => {
    setUrlInput(videoUrl || '');
  }, [videoUrl]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (getPlayerTime) {
        const { time, duration } = await getPlayerTime();
        if (duration > 0) {
          setProgress((time / duration) * 100);
          
          const format = (seconds) => {
             const m = Math.floor(seconds / 60);
             const s = Math.floor(seconds % 60);
             return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
          };
          setTimeStr(format(time));
        } else {
          setProgress(0);
          setTimeStr('00:00');
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [getPlayerTime]);

  function handleUrlSubmit(e) {
    e.preventDefault();
    setUrlError('');

    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError('Please enter a YouTube URL.');
      return;
    }

    const isYouTubeUrl = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    const isBareId     = /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

    if (!isYouTubeUrl && !isBareId) {
      setUrlError('Please enter a valid YouTube URL or video ID.');
      return;
    }

    onChangeVideo(trimmed);
  }



  return (
    <div className="video-controls">

      {/* ── Progress row (visual only for now) ─────────────────────────── */}
      <div className="controls-progress-row">
        <span className="controls-time">{timeStr}</span>
        <div className="controls-progress-bar">
          <div className="controls-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="controls-live-badge">LIVE</span>
      </div>

      {/* ── Main controls row ──────────────────────────────────────────── */}
      <div className="controls-main-row">
        


        {/* URL form */}
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
            className="btn-change-video"
            type="submit"
            disabled={!canControl}
          >
            UPDATE
          </button>
        </form>
      </div>
      
      {urlError && <p className="control-error">{urlError}</p>}
      
      {!canControl && (
        <p className="viewer-notice">
          👁 Viewer — only the host/moderator controls playback
        </p>
      )}

    </div>
  );
}