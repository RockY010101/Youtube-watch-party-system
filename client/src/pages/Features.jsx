import Navbar from '../components/Navbar.jsx';

export default function Features() {
  return (
    <div className="home-page">
      <Navbar />
      <div className="home-hero" style={{ marginTop: '2rem' }}>
        <h1 className="hero-title">
          Powerful <span className="gradient-text">Features</span>
        </h1>
        <p className="hero-sub">
          Everything you need for the perfect remote viewing experience.
        </p>
      </div>
      <div className="home-cards" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', padding: '0 2rem', paddingBottom: '4rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🎥 Perfect Synchronization</h2>
          </div>
          <p style={{ padding: '0 1.5rem 1.5rem', color: '#aaa', lineHeight: '1.6' }}>
            When the host plays, pauses, or seeks the video, everyone else in the room sees the same action instantly. No more counting down "3, 2, 1, play!" over voice chat.
          </p>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🛡️ Role-Based Access Control</h2>
          </div>
          <p style={{ padding: '0 1.5rem 1.5rem', color: '#aaa', lineHeight: '1.6' }}>
            Rooms have Hosts, Moderators, and Participants. Only authorized users can control the video, ensuring your watch party isn't interrupted by unexpected skips.
          </p>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">💬 Live Chat Integration</h2>
          </div>
          <p style={{ padding: '0 1.5rem 1.5rem', color: '#aaa', lineHeight: '1.6' }}>
            React and discuss the video in real-time with an integrated live chat right next to the video player. Stay connected with your friends.
          </p>
        </div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">👑 Auto Host Transfer</h2>
          </div>
          <p style={{ padding: '0 1.5rem 1.5rem', color: '#aaa', lineHeight: '1.6' }}>
            If the host has to leave early, the party doesn't stop. The room automatically transfers host privileges to the next participant so you can keep watching.
          </p>
        </div>
      </div>
    </div>
  );
}
