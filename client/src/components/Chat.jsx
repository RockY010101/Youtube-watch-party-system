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

export default function Chat({ messages, myUserId, displayName, onSendMessage, onSendReaction, typingUsers = [], onTypingStart, onTypingStop }) {
  const [input, setInput]     = useState('');
  const bottomRef             = useRef(null);
  const typingTimeoutRef      = useRef(null);

  const reactions = ['😂', '😮', '🔥', '❤️', '👏', '💀'];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  function handleInputChange(e) {
    setInput(e.target.value);
    
    if (onTypingStart) {
      onTypingStart();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setInput('');
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (onTypingStop) onTypingStop();
  }

  function handleReaction(reaction) {
    if (onSendReaction) {
      onSendReaction(reaction);
    }
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

  function renderTypingIndicator() {
    const othersTyping = typingUsers.filter(u => u.userId !== myUserId);
    if (!othersTyping || othersTyping.length === 0) return null;

    let text = '';
    const avatars = [];

    if (othersTyping.length === 1) {
      text = `${othersTyping[0].displayName} is typing...`;
      avatars.push(othersTyping[0].displayName.charAt(0).toUpperCase());
    } else if (othersTyping.length === 2) {
      text = `${othersTyping[0].displayName} and ${othersTyping[1].displayName} are typing...`;
      avatars.push(othersTyping[0].displayName.charAt(0).toUpperCase());
      avatars.push(othersTyping[1].displayName.charAt(0).toUpperCase());
    } else {
      const remaining = othersTyping.length - 2;
      text = `${othersTyping[0].displayName}, ${othersTyping[1].displayName} and +${remaining} are typing...`;
      avatars.push(othersTyping[0].displayName.charAt(0).toUpperCase());
      avatars.push(othersTyping[1].displayName.charAt(0).toUpperCase());
    }

    return (
      <div className="typing-indicator-wrapper">
        <div className="typing-avatars">
           {avatars.map((initial, i) => (
             <div key={i} className="chat-avatar-sm typing-avatar" style={{ zIndex: avatars.length - i }}>{initial}</div>
           ))}
        </div>
        <div className="typing-bubble">
          <span className="dot"></span><span className="dot"></span><span className="dot"></span>
        </div>
        <span className="typing-text">{text}</span>
      </div>
    );
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

        {renderTypingIndicator()}

        <div ref={bottomRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          className="chat-input"
          type="text"
          placeholder={`Message as ${displayName}…`}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          maxLength={500}
          autoComplete="off"
        />

        <div className="reaction-menu-wrapper">
          <button className="reaction-trigger-btn" type="button" title="Reactions">
            ❤️
          </button>
          <div className="chat-reactions-bar">
            {reactions.map((emoji) => (
              <button
                key={emoji}
                className="chat-reaction-btn"
                type="button"
                onClick={() => handleReaction(emoji)}
                title={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

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