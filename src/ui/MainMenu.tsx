import React from 'react';

interface MainMenuProps {
  onPlay: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onPlay }) => {
  return (
    <div className="main-menu interactive">
      <div className="glass-panel menu-content">
        <h1 className="game-title">Trackval<br/>Obby</h1>
        <button className="btn btn-primary" onClick={onPlay}>
          Play Now
        </button>
        <button className="btn">
          Leaderboard
        </button>
        <button className="btn">
          Settings
        </button>
      </div>
    </div>
  );
};

export default MainMenu;
