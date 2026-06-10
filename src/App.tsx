import { useState } from 'react';
import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import { Renderer } from './components/Renderer';
import './index.css';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');

  return (
    <div className="game-container">
      {/* 3D Environment Background / Gameplay */}
      {/* 3D Environment Background / Gameplay */}
      <Renderer />

      {/* 2D UI Overlay */}
      <div className="ui-overlay">
        {gameState === 'menu' && (
          <MainMenu onPlay={() => setGameState('playing')} />
        )}
        {gameState === 'playing' && (
          <HUD />
        )}
      </div>
    </div>
  );
}

export default App;
