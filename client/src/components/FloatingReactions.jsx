import { useEffect, useState } from 'react';
import './FloatingReactions.css';

export default function FloatingReactions({ reactions }) {
  const [activeReactions, setActiveReactions] = useState([]);

  useEffect(() => {
    if (reactions.length === 0) return;

    // Get the latest reaction
    const newReaction = reactions[reactions.length - 1];
    
    // Add it with a random drift value for the CSS animation
    const drift = Math.floor(Math.random() * 40) - 20; // -20 to 20px
    const reactionWithDrift = { ...newReaction, drift };

    setActiveReactions(prev => [...prev, reactionWithDrift]);

    // Remove the reaction after animation completes (3 seconds)
    const timeoutId = setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [reactions]);

  return (
    <div className="floating-reactions-container">
      {activeReactions.map((r) => (
        <div
          key={r.id}
          className="floating-reaction"
          style={{ '--drift-x': `${r.drift}px` }}
        >
          {r.reaction}
        </div>
      ))}
    </div>
  );
}
