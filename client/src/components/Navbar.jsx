import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className="home-navbar">
      <div className="navbar-brand">
        <div className="navbar-logo-icon" />
        <div>
          <span className="navbar-brand-name">YouTube Watch Party</span>
          <span className="navbar-brand-sub">Watch YouTube videos together in real time.</span>
        </div>
      </div>

      <div className="navbar-links">
        <Link to="/" className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Home</Link>
        <Link to="/features" className={`navbar-link ${location.pathname === '/features' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Features</Link>
        <Link to="/how-it-works" className={`navbar-link ${location.pathname === '/how-it-works' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>How it Works</Link>
      </div>

      {/* 
      <div className="navbar-actions">
        <div className="navbar-icon-btn" title="Notifications">🔔</div>
        <div className="navbar-icon-btn" title="Settings">⚙️</div>
        <div className="navbar-avatar">Y</div>
      </div>
      */}
    </nav>
  );
}
