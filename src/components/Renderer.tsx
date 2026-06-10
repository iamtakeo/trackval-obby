import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { generateTrackCurve } from '../utils/trackGenerator';
import { TrackMesh } from './TrackMesh';
import { CarMesh } from './CarMesh';

export function Renderer() {
  // Generate the procedural track DNA only once
  const curve = useMemo(() => generateTrackCurve(), []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas
        gl={{ antialias: false }} // Optimization for postprocessing
        camera={{ position: [0, 10, 20], fov: 75 }}
      >
        {/* Dark deep-space aesthetic background */}
        <color attach="background" args={['#030308']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.3} color="#ffffff" />
        <directionalLight position={[100, 200, 100]} intensity={2} color="#e0eaff" />
        
        {/* Starfield backdrop */}
        <Stars radius={200} depth={50} count={8000} factor={4} saturation={1} fade speed={1.5} />
        
        {/* Game Entities */}
        <TrackMesh curve={curve} />
        <CarMesh curve={curve} />

        {/* Post-processing effects for high-speed arcade feel */}
        <EffectComposer>
          <Bloom 
            luminanceThreshold={0.2} 
            mipmapBlur 
            intensity={1.5} 
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
