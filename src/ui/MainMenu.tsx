import React, { useState } from 'react';
import { gameStore } from '../store';

interface MainMenuProps {
  onPlay: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onPlay }) => {
  const [name, setName] = useState(gameStore.getPlayerName());

  const handlePlay = () => {
    gameStore.setPlayerName(name || "Guest");
    onPlay();
  };

  return (
    <div className="main-menu interactive">
      <div className="glass-panel menu-content">
        <h1 className="game-title">Trackval<br/>Obby</h1>
        
        <div style={{ marginBottom: '20px', width: '100%' }}>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={16}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #00e5ff',
              background: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              fontSize: '16px',
              textAlign: 'center',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button className="btn btn-primary" onClick={handlePlay}>
          Play Now
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
