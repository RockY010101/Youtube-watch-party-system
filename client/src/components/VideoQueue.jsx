// VideoQueue.jsx
// Displays the room's video queue.
// Host view: add input + remove/reorder controls + "Play Next" button
// Viewer view: read-only list showing "Up Next" on the first item.

import { useState } from 'react';
import './VideoQueue.css';

// ── Thumbnail helper ──────────────────────────────────────────────────────────
function extractVideoId(input) {
  if (!input) return '';
  let str = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  if (!str.startsWith('http')) str = 'https://' + str;
  try {
    const url = new URL(str);
    if (url.searchParams.get('v')) return url.searchParams.get('v');
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0];
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2];
  } catch { return ''; }
  return '';
}

function YTThumb({ url }) {
  const id = extractVideoId(url);
  if (!id) return <div className="queue-thumb queue-thumb--empty" />;
  return (
    <img
      className="queue-thumb"
      src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
      alt="thumbnail"
      loading="lazy"
    />
  );
}

// ── Queue Item ────────────────────────────────────────────────────────────────
function QueueItem({ item, index, total, isHost, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className={`queue-item ${index === 0 ? 'queue-item--next' : ''}`}>
      {/* Position badge */}
      <div className="queue-item__pos">
        {index === 0 ? <span className="queue-up-next">▶</span> : <span>{index + 1}</span>}
      </div>

      {/* Thumbnail */}
      <YTThumb url={item.url} />

      {/* Info */}
      <div className="queue-item__info">
        <span className="queue-item__url" title={item.url}>
          {item.url.length > 38 ? item.url.slice(0, 35) + '…' : item.url}
        </span>
        <span className="queue-item__meta">Added by {item.addedBy}</span>
      </div>

      {/* Host-only controls */}
      {isHost && (
        <div className="queue-item__actions">
          <button
            className="queue-ctrl-btn"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            title="Move up"
          >▲</button>
          <button
            className="queue-ctrl-btn"
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1}
            title="Move down"
          >▼</button>
          <button
            className="queue-ctrl-btn queue-ctrl-btn--remove"
            onClick={() => onRemove(item.id)}
            title="Remove"
          >✕</button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VideoQueue({
  queue,
  isHost,
  onAdd,
  onRemove,
  onReorder,
  onPlayNext,
}) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError]       = useState('');

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) { setError('Paste a YouTube URL first.'); return; }
    const id = extractVideoId(trimmed);
    if (!id) { setError('Not a valid YouTube URL.'); return; }
    setError('');
    onAdd(trimmed);
    setInputUrl('');
  }

  return (
    <div className="video-queue">

      {/* ── Host add-to-queue form ─────────────────────────────────────── */}
      {isHost && (
        <form className="queue-add-form" onSubmit={handleAdd}>
          <div className="queue-add-row">
            <input
              id="queue-url-input"
              className="queue-url-input"
              type="text"
              placeholder="Paste YouTube URL to queue…"
              value={inputUrl}
              onChange={e => { setInputUrl(e.target.value); setError(''); }}
              autoComplete="off"
            />
            <button id="queue-add-btn" className="queue-add-btn" type="submit">
              + Add
            </button>
          </div>
          {error && <p className="queue-error">{error}</p>}
        </form>
      )}

      {/* ── Queue list ────────────────────────────────────────────────── */}
      {queue.length === 0 ? (
        <div className="queue-empty">
          <span className="queue-empty__icon">🎬</span>
          <p className="queue-empty__text">
            {isHost
              ? 'Add videos above to build the queue.'
              : 'The host hasn\'t queued any videos yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Host-only Play Next button */}
          {isHost && (
            <button
              id="queue-play-next-btn"
              className="queue-play-next-btn"
              onClick={onPlayNext}
            >
              ⏭ Play Next Now
            </button>
          )}

          <div className="queue-list">
            {queue.map((item, index) => (
              <QueueItem
                key={item.id}
                item={item}
                index={index}
                total={queue.length}
                isHost={isHost}
                onRemove={onRemove}
                onMoveUp={(i)   => onReorder(i, i - 1)}
                onMoveDown={(i) => onReorder(i, i + 1)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
