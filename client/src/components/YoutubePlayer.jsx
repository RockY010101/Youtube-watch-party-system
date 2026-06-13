// YoutubePlayer.jsx — YouTube IFrame API wrapper
// Uses a simple iframe embed URL approach — most reliable method

import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';

function extractVideoId(input) {
  if (!input) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input);
    if (url.searchParams.get('v')) return url.searchParams.get('v');
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0];
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2];
  } catch { return ''; }
  return '';
}

const YoutubePlayer = forwardRef(function YoutubePlayer(
  { videoUrl, canControl, onPlay, onPause },
  ref
) {
  const playerRef      = useRef(null);
  const suppressEvents = useRef(false);
  const lastVideoId    = useRef('');
  const apiLoaded      = useRef(false);
  // BUG FIX (Bug 2): canControl is captured once at player init time.
  // If the user's role changes later (e.g. host promotes them),
  // the stale closure inside onStateChange would still read the old value.
  // Using a ref lets the callback always read the LATEST canControl.
  const canControlRef  = useRef(canControl);
  const [currentVideoId, setCurrentVideoId] = useState('');

  // Keep canControlRef in sync whenever the prop changes
  useEffect(() => { canControlRef.current = canControl; }, [canControl]);

  // Load YouTube API once
  useEffect(() => {
    if (apiLoaded.current) return;
    apiLoaded.current = true;

    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }

    window.onYouTubeIframeAPIReady = initPlayer;

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  }, []);

  function initPlayer() {
    if (playerRef.current) return; // already initialized

    playerRef.current = new window.YT.Player('yt-player', {
      height: '400',
      width: '100%',
      playerVars: {
        controls: 1,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => console.log('[YT] Player ready'),
        onStateChange: (e) => {
          if (suppressEvents.current) return;
          if (!canControlRef.current) return;  // BUG FIX: use ref, not stale closure
          const t = e.target.getCurrentTime();
          if (e.data === 1) onPlay(t);   // 1 = playing
          if (e.data === 2) onPause(t);  // 2 = paused
        },
        onError: (e) => console.error('[YT] Error:', e.data),
      },
    });
  }

  useImperativeHandle(ref, () => ({
    syncTo({ videoUrl: url, currentTime, playing }) {
      const videoId = extractVideoId(url);
      if (!videoId) { console.warn('[YT] Could not extract videoId from:', url); return; }

      console.log('[YT] syncTo', videoId, currentTime, playing);
      setCurrentVideoId(videoId); // show the player div

      const p = playerRef.current;
      if (!p || typeof p.loadVideoById !== 'function') {
        console.warn('[YT] Player not ready yet');
        return;
      }

      suppressEvents.current = true;

      if (videoId !== lastVideoId.current) {
        lastVideoId.current = videoId;
        console.log('[YT] Loading new video:', videoId);
        p.loadVideoById({ videoId, startSeconds: currentTime });
        if (!playing) {
          setTimeout(() => { p.pauseVideo(); suppressEvents.current = false; }, 1500);
        } else {
          setTimeout(() => { suppressEvents.current = false; }, 1500);
        }
      } else {
        p.seekTo(currentTime, true);
        playing ? p.playVideo() : p.pauseVideo();
        setTimeout(() => { suppressEvents.current = false; }, 500);
      }
    },

    getCurrentTime() {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return Promise.resolve(0);
      return Promise.resolve(p.getCurrentTime() || 0);
    },
  }));

  return (
    <div style={{ width: '100%', background: '#000' }}>
      {!currentVideoId && (
        <div className="player-placeholder">
          <span className="placeholder-icon">▶</span>
          <p className="placeholder-text">
            {canControl
              ? 'Paste a YouTube URL below to start watching'
              : 'Waiting for the host to choose a video…'}
          </p>
        </div>
      )}
      <div
        id="yt-player"
        style={{
          width: '100%',
          height: '400px',
          display: currentVideoId ? 'block' : 'none',
        }}
      />
    </div>
  );
});

export default YoutubePlayer;