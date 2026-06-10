import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment, Plane } from '@react-three/drei';
import { generateTrackCurve } from '../utils/trackGenerator';
import { TrackMesh } from './TrackMesh';
import { CarMesh } from './CarMesh';

export function Renderer() {
  // Generate the procedural track DNA only once
  const curve = useMemo(() => generateTrackCurve(), []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        camera={{ position: [0, 10, 20], fov: 75 }}
        shadows
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
        />
        <ambientLight intensity={0.4} />
        
        {/* Ground Plane far below */}
        <Plane args={[10000, 10000]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -100, 0]} receiveShadow>
          <meshStandardMaterial color="#3b7a33" roughness={0.8} />
        </Plane>
        
        {/* Game Entities */}
        <TrackMesh curve={curve} />
        <CarMesh curve={curve} />
      </Canvas>
    </div>
  );
}
