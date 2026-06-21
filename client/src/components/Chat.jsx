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
import './Chat.css';

export default function Chat({ messages, myUserId, displayName, onSendMessage }) {
  const [input, setInput]     = useState('');
  const bottomRef             = useRef(null);

  const reactions = ['😂', '😮', '🔥', '❤️', '👏', '💀'];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput('');
  }

  function handleReaction(reaction) {
    onSendMessage(reaction);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="chat">
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
              {!isMe && (
                <div className="chat-meta">
                  <div className="chat-avatar-sm">{msg.displayName.charAt(0).toUpperCase()}</div>
                  <span className="chat-sender">{msg.displayName}</span>
                  <span className="chat-sender-time">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              {isMe && (
                <div className="chat-mine-meta">
                  <span className="chat-sender-time">{formatTime(msg.timestamp)}</span>
                  <span className="chat-sender">{msg.displayName}</span>
                  <div className="chat-avatar-sm">{msg.displayName.charAt(0).toUpperCase()}</div>
                </div>
              )}
              <div className="chat-bubble">
                <span className="chat-text">{msg.message}</span>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="chat-reactions-bar">
        {reactions.map((emoji) => (
          <button
            key={emoji}
            className="chat-reaction-btn"
            onClick={() => handleReaction(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

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
          className="btn-send"
          type="submit"
          disabled={!input.trim()}
        >
          Send
        </button>
      </form>

    </div>
  );
}