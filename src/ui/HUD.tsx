import React, { useEffect, useState } from 'react';

const HUD: React.FC = () => {
  const [speed, setSpeed] = useState(0);
  const [time, setTime] = useState(0);

  // Mocking game data for demonstration
  useEffect(() => {
    // Timer
    const timeInterval = setInterval(() => {
      setTime(prev => prev + 10); // increments of 10ms
    }, 10);

    // Speed fluctuation
    const speedInterval = setInterval(() => {
      setSpeed(prev => {
        // Random fluctuation for realistic speedometer effect
        const target = 140 + Math.random() * 40;
        return Math.floor(prev + (target - prev) * 0.1);
      });
    }, 100);

    return () => {
      clearInterval(timeInterval);
      clearInterval(speedInterval);
    };
  }, []);

  // Format time as MM:SS:ms
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hud-container">
      <div className="hud-element timer-widget glass-panel">
        <div className="timer-label">Lap Time</div>
        <div className="timer-value">{formatTime(time)}</div>
      </div>
      
      <div className="hud-element speedometer-widget glass-panel">
        <div className="speed-label">Speed</div>
        <div className="speed-value">
          {speed} <span className="speed-unit">u/s</span>
        </div>
      </div>
    </div>
  );
};

export default HUD;
