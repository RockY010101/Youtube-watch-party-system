import { useState } from 'react';
import './PollWidget.css';

export default function PollWidget({ poll, isHost, myUserId, onCreate, onVote, onClose }) {
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState([{ id: 1, text: '' }, { id: 2, text: '' }]);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    const validOptions = options.filter(o => o.text.trim());
    if (validOptions.length < 2) return;

    onCreate({
      question: question.trim(),
      options: validOptions.map(o => ({ id: o.id.toString(), text: o.text.trim() }))
    });
    setIsCreating(false);
    setQuestion('');
    setOptions([{ id: 1, text: '' }, { id: 2, text: '' }]);
  };

  const handleAddOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, { id: Date.now(), text: '' }]);
  };

  const handleOptionChange = (id, text) => {
    setOptions(options.map(o => o.id === id ? { ...o, text } : o));
  };

  // If no poll is active
  if (!poll) {
    if (!isHost) return null; // Viewers see nothing when no poll
    
    if (isCreating) {
      return (
        <div className="poll-widget poll-widget--creating">
          <form onSubmit={handleCreate}>
            <div className="poll-header">
              <h3>Create a Poll</h3>
              <button type="button" className="poll-close-btn" onClick={() => setIsCreating(false)}>✕</button>
            </div>
            <input 
              className="poll-input poll-input--question" 
              placeholder="Ask your community..." 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoFocus
            />
            <div className="poll-options-inputs">
              {options.map((opt, i) => (
                <input 
                  key={opt.id}
                  className="poll-input poll-input--option" 
                  placeholder={`Option ${i + 1}`} 
                  value={opt.text}
                  onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                />
              ))}
            </div>
            {options.length < 4 && (
              <button type="button" className="poll-add-opt-btn" onClick={handleAddOption}>
                + Add Option
              </button>
            )}
            <button 
              type="submit" 
              className="poll-submit-btn" 
              disabled={!question.trim() || options.filter(o => o.text.trim()).length < 2}
            >
              Ask
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="poll-widget poll-widget--idle">
        <button className="poll-init-btn" onClick={() => setIsCreating(true)}>
          <span className="poll-icon">📊</span> Create Poll
        </button>
      </div>
    );
  }

  // Poll is active
  const hasVoted = poll.votedUsers.includes(myUserId);
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div className="poll-widget poll-widget--active">
      <div className="poll-header">
        <h3 className="poll-question">{poll.question}</h3>
        {isHost && (
          <button className="poll-close-btn" onClick={onClose} title="End Poll">✕</button>
        )}
      </div>

      <div className="poll-options-list">
        {poll.options.map(opt => {
          const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          return (
            <div 
              key={opt.id} 
              className={`poll-option ${hasVoted ? 'poll-option--voted' : ''}`}
              onClick={() => {
                if (!hasVoted) onVote(opt.id);
              }}
            >
              {hasVoted ? (
                <>
                  <div className="poll-option-fill" style={{ width: `${percentage}%` }}></div>
                  <div className="poll-option-content">
                    <span className="poll-option-text">{opt.text}</span>
                    <span className="poll-option-pct">{percentage}%</span>
                  </div>
                </>
              ) : (
                <div className="poll-option-content">
                  <div className="poll-radio-circle"></div>
                  <span className="poll-option-text">{opt.text}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="poll-footer">
        <span className="poll-votes-count">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
