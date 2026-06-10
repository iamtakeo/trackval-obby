import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import MainMenu from './ui/MainMenu';
import HUD from './ui/HUD';
import './index.css';

function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');

  return (
    <div className="game-container">
      {/* 3D Environment Background / Gameplay */}
      <Canvas>
        <color attach="background" args={['#0a0a0f']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        
        {/* Placeholder 3D content to show Canvas is working */}
        <Box args={[2, 2, 2]} rotation={[0.5, 0.5, 0]}>
          <meshStandardMaterial color="#aa3bff" wireframe={gameState === 'menu'} />
        </Box>
        
        {gameState === 'playing' && (
          <OrbitControls autoRotate autoRotateSpeed={2} />
        )}
      </Canvas>

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
