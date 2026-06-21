import Navbar from '../components/Navbar.jsx';
import './HowItWorks.css';

export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Create a Room',
      description: 'Navigate to the Home page and enter your display name to start a new party. You will automatically become the Host and receive a unique 6-character room code.',
      image: '/images/step_1.png'
    },
    {
      number: '2',
      title: 'Invite Friends',
      description: 'Share the room code or the direct room link with your friends. They can join your room by simply entering the code and their name on the Home page.',
      image: '/images/step_2.png'
    },
    {
      number: '3',
      title: 'Watch Together',
      description: 'Paste any YouTube URL into the player. As the host, you have full control over the playback. Sit back, relax, and enjoy the show together in perfect sync!',
      image: '/images/step_3.png'
    }
  ];

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
      
      <div className="how-it-works-container">
        {steps.map((step, index) => (
          <div key={index} className="step-card">
            <div className="step-image-container">
              <img src={step.image} alt={step.title} className="step-image" />
            </div>
            <div className="step-content">
              <div className="step-header">
                <span className="step-number">{step.number}</span>
                <h2 className="step-title">{step.title}</h2>
              </div>
              <p className="step-description">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
