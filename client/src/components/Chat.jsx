// Chat.jsx — Live chat sidebar
//
// Displays all chat messages and an input to send new ones.
//
// Key behaviours:
//   • Auto-scrolls to the latest message whenever messages change
//   • Highlights YOUR messages differently from others
//   • Sends on Enter key or clicking Send
//   • Server echoes your message back to you (so don't add it locally)
//
// Props:
//   messages     — array of { userId, displayName, message, timestamp }
//   myUserId     — string: your userId (to style your own messages differently)
//   displayName  — string: your display name (shown in the input area)
//   onSendMessage — function(message): emits chat_message to server

import { useState, useEffect, useRef } from 'react';

export default function Chat({ messages, myUserId, displayName, onSendMessage }) {
  const [input, setInput]     = useState('');
  const bottomRef             = useRef(null); // ref to the bottom of the message list

  // Auto-scroll to bottom whenever a new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── handleSend ─────────────────────────────────────────────────────────
  function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput(''); // clear input after sending
    // Note: we do NOT push to messages here — the server echoes it back
    // via the chat_message event, which Room.jsx adds to the messages array.
    // This ensures consistency (one source of truth = the server).
  }

  // ── handleKeyDown ──────────────────────────────────────────────────────
  // Send on Enter, allow Shift+Enter for newlines
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  // ── formatTime ─────────────────────────────────────────────────────────
  // Format a Unix timestamp as HH:MM
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="chat">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="chat-header">
        <span className="chat-header-icon">💬</span>
        <span className="chat-header-title">Chat</span>
        <span className="chat-message-count">{messages.length}</span>
      </div>

      {/* ── Message list ────────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">No messages yet. Say hello! 👋</p>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.userId === myUserId;
          return (
            <div
              key={index}
              className={`chat-message ${isMe ? 'chat-message-mine' : 'chat-message-theirs'}`}
            >
              {/* Show sender name only for other people's messages */}
              {!isMe && (
                <span className="chat-sender">{msg.displayName}</span>
              )}
              <div className="chat-bubble">
                <span className="chat-text">{msg.message}</span>
                <span className="chat-time">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          );
        })}

        {/* Invisible div at the bottom — scrolled into view on new messages */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────── */}
      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          className="chat-input"
          type="text"
          placeholder={`Message as ${displayName}…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          autoComplete="off"
        />
        <button
          className="btn btn-send"
          type="submit"
          disabled={!input.trim()}
        >
          Send
        </button>
      </form>

    </div>
  );
}