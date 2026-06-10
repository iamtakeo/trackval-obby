import { useState, useEffect } from 'react';
import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import { GeneratorMenu } from './ui/GeneratorMenu';
import { Renderer } from './components/Renderer';
import { gameStore } from './store';
import './index.css';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState === 'playing') {
        gameStore.setMenuOpen(!gameStore.getMenuOpen());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  return (
    <div className="game-container">
      {/* 3D Environment Background / Gameplay */}
      <Renderer />

      {/* 2D UI Overlay */}
      <div className="ui-overlay">
        {gameState === 'menu' && (
          <MainMenu onPlay={() => setGameState('playing')} />
        )}
        {gameState === 'playing' && (
          <>
            <HUD />
            <GeneratorMenu />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
