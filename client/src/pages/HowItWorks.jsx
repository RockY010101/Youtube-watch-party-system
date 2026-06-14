import Navbar from '../components/Navbar.jsx';

export default function HowItWorks() {
  return (
    <div className="home-page">
      <Navbar />
      <div className="home-hero" style={{ marginTop: '2rem' }}>
        <h1 className="hero-title">
          How it <span className="gradient-text">Works</span>
        </h1>
        <p className="hero-sub">
          Get started with YouTube Watch Party in three simple steps.
        </p>
      </div>
      <div className="home-cards" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', padding: '0 2rem', paddingBottom: '4rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ padding: '1.5rem', fontSize: '3rem', fontWeight: 'bold', color: '#ff2e55' }}>1</div>
          <div>
            <div className="card-header" style={{ paddingLeft: 0 }}>
              <h2 className="card-title">Create a Room</h2>
            </div>
            <p style={{ padding: '0 1.5rem 1.5rem 0', color: '#aaa', lineHeight: '1.6' }}>
              Navigate to the Home page and enter your display name to start a new party. You will automatically become the Host and receive a unique 6-character room code.
            </p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ padding: '1.5rem', fontSize: '3rem', fontWeight: 'bold', color: '#ff2e55' }}>2</div>
          <div>
            <div className="card-header" style={{ paddingLeft: 0 }}>
              <h2 className="card-title">Invite Friends</h2>
            </div>
            <p style={{ padding: '0 1.5rem 1.5rem 0', color: '#aaa', lineHeight: '1.6' }}>
              Share the room code or the direct room link with your friends. They can join your room by simply entering the code and their name on the Home page.
            </p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ padding: '1.5rem', fontSize: '3rem', fontWeight: 'bold', color: '#ff2e55' }}>3</div>
          <div>
            <div className="card-header" style={{ paddingLeft: 0 }}>
              <h2 className="card-title">Watch Together</h2>
            </div>
            <p style={{ padding: '0 1.5rem 1.5rem 0', color: '#aaa', lineHeight: '1.6' }}>
              Paste any YouTube URL into the player. As the host, you have full control over the playback. Sit back, relax, and enjoy the show together in perfect sync!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
