import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment, Plane } from '@react-three/drei';
import { TrackMesh } from './TrackMesh';
import { CarMesh } from './CarMesh';
import { OtherPlayers } from './OtherPlayers';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { gameStore } from '../store';
import type { TrackData } from '../utils/trackGenerator';

export function Renderer() {
  const [trackData, setTrackData] = useState<TrackData | null>(gameStore.getTrackData());

  useEffect(() => {
    const unsubscribe = gameStore.subscribe(() => {
      setTrackData(gameStore.getTrackData());
    });
    return unsubscribe;
  }, []);
  
  // Hook up multiplayer
  const { players, updateMyState } = useMultiplayer();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 10, 20], fov: 75 }}
        shadows={{ type: THREE.PCFShadowMap }}
      >
        {/* Skybox and environmental lighting */}
        <Sky distance={450000} sunPosition={[100, 20, 100]} inclination={0} azimuth={0.25} />
        <Environment preset="park" />
        
        {/* Direct sunlight for shadows */}
        <directionalLight 
          position={[100, 200, 100]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048} 
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />
        <ambientLight intensity={0.4} />
        
        {/* Ground Plane at Y = 0 */}
        <Plane args={[10000, 10000]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <meshStandardMaterial color="#3b7a33" roughness={0.8} />
        </Plane>
        
        {/* Game Entities */}
        {trackData && <TrackMesh trackData={trackData} />}
        {trackData && <CarMesh trackData={trackData} updateMyState={updateMyState} />}
        <OtherPlayers players={players} />
      </Canvas>
    </div>
  );
}
