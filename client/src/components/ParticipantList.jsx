// ParticipantList.jsx — Sidebar list of all room participants
//
// Shows every participant with:
//   • Their display name
//   • A role badge (Host / Mod / Viewer)
//   • If YOU are the host: a dropdown to promote/demote + a remove button
//
// Props:
//   participants        — array of { userId, displayName, role }
//   myUserId            — string: your userId (so we can label "You")
//   isHost              — boolean: true if you are the host
//   onAssignRole        — function(targetUserId, role): emits assign_role
//   onRemoveParticipant — function(targetUserId): emits remove_participant

export default function ParticipantList({
  participants,
  myUserId,
  isHost,
  onAssignRole,
  onRemoveParticipant,
}) {

  function roleBadge(role) {
    const labels = {
      host:        'Host',
      moderator:   'Moderator',
      participant: 'Participant',
    };
    return (
      <span className={`role-badge role-badge-${role}`}>
        {labels[role] || role}
      </span>
    );
  }

  function handleRoleChange(targetUserId, newRole) {
    onAssignRole(targetUserId, newRole);
  }

  function handleRemove(targetUserId, displayName) {
    const confirmed = window.confirm(`Remove "${displayName}" from the room?`);
    if (confirmed) onRemoveParticipant(targetUserId);
  }

  return (
    <div className="participant-list">
      
      {/* Online count */}
      <div className="members-online-count">Online — {participants.length}</div>

      <ul className="participant-items">
        {participants.map((p) => {
          const isMe     = p.userId === myUserId;
          const isTarget = !isMe && p.role !== 'host'; // host can act on non-host others

          return (
            <li key={p.userId} className={`participant-item ${isMe ? 'participant-me' : ''}`}>

              {/* Avatar initial */}
              <div className="participant-avatar">
                {p.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Name + role */}
              <div className="participant-info">
                <span className="participant-name">
                  {p.displayName}
                  {isMe && <span className="participant-you-tag"> (you)</span>}
                </span>
                {roleBadge(p.role)}
              </div>

              {/* Host controls */}
              {isHost && isTarget && (
                <div className="participant-actions">
                  <select
                    className="role-select"
                    value={p.role}
                    onChange={e => handleRoleChange(p.userId, e.target.value)}
                    title="Change role"
                  >
                    <option value="moderator">Mod</option>
                    <option value="participant">Viewer</option>
                  </select>
                  <button
                    className="btn-remove"
                    onClick={() => handleRemove(p.userId, p.displayName)}
                    title={`Remove ${p.displayName}`}
                  >
                    ✕
                  </button>
                </div>
              )}

            </li>
          );
        })}
      </ul>

    </div>
  );
}