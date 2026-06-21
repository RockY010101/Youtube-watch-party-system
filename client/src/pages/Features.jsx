import { useEffect, useRef, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import './Features.css';

function FeatureItem({ icon, title, description }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      });
    }, { threshold: 0.2 });

    const currentRef = domRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div ref={domRef} className={`feature-block ${isVisible ? 'is-visible' : ''}`}>
      <div className="feature-header">
        <div className="feature-icon-wrapper">
          {icon}
        </div>
        <h2 className="feature-title">{title}</h2>
      </div>
      <p className="feature-description">
        {description}
      </p>
    </div>
  );
}

export default function Features() {
  const featuresData = [
    {
      icon: '🎥',
      title: 'Perfect Synchronization',
      description: 'When the host plays, pauses, or seeks the video, everyone else in the room sees the same action instantly. No more counting down "3, 2, 1, play!" over voice chat.'
    },
    {
      icon: '🛡️',
      title: 'Role-Based Access Control',
      description: 'Rooms have Hosts, Moderators, and Participants. Only authorized users can control the video, ensuring your watch party isn\'t interrupted by unexpected skips.'
    },
    {
      icon: '💬',
      title: 'Live Chat Integration',
      description: 'React and discuss the video in real-time with an integrated live chat right next to the video player. Stay connected with your friends.'
    },
    {
      icon: '👑',
      title: 'Auto Host Transfer',
      description: 'If the host has to leave early, the party doesn\'t stop. The room automatically transfers host privileges to the next participant so you can keep watching.'
    }
  ];

  return (
    <div className="home-page">
      <Navbar />
      <div className="home-hero" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h1 className="hero-title">
          Powerful <span className="gradient-text">Features</span>
        </h1>
        <p className="hero-sub">
          Everything you need for the perfect remote viewing experience.
        </p>
      </div>
      
      <div className="features-container">
        {featuresData.map((feature, index) => (
          <FeatureItem key={index} {...feature} />
        ))}
      </div>
    </div>
  );
}
