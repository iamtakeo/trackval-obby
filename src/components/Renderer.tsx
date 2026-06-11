import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment, Plane } from '@react-three/drei';
import { TrackMesh } from './TrackMesh';
import { RampsMesh } from './RampsMesh';
import { CarMesh } from './CarMesh';
import { OtherPlayers } from './OtherPlayers';
import { useMultiplayer } from '../hooks/useMultiplayer';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';
import type { TrackData } from '../utils/trackGenerator';
import { generateRamps } from '../utils/rampData';
import { SpectatorCamera } from './SpectatorCamera';

export function Renderer() {
  const [trackData, setTrackData] = useState<TrackData | null>(gameStore.getTrackData());
  const [isSpectating, setIsSpectating] = useState(gameStore.getIsSpectating());

  useEffect(() => {
    const unsubscribe = gameStore.subscribe(() => {
      setTrackData(gameStore.getTrackData());
      setIsSpectating(gameStore.getIsSpectating());
    });
    return unsubscribe;
  }, []);
  
  // Hook up multiplayer
  const { players, updateMyState, isConnected, broadcastTrack, socketId } = useMultiplayer();

  // Filter out the local player from the remote players list
  const remotePlayers = Object.fromEntries(
    Object.entries(players).filter(([id]) => id !== socketId)
  );

  useEffect(() => {
    // If we've connected to the global instance but haven't received a track sync,
    // we might be the first player in the room!
    if (isConnected && !trackData) {
      const timer = setTimeout(() => {
        if (!gameStore.getTrackData()) {
          console.log("No global track received, generating one as the host...");
          const newTrack = generateTrackCurve({});
          gameStore.setTrackData(newTrack);
          const newRamps = generateRamps(5); // default frequency
          gameStore.setRamps(newRamps);
          if (newTrack.dna) {
            broadcastTrack(newTrack.dna, newRamps);
          }
        }
      }, 1000); // Wait 1 second to make absolutely sure no sync message is incoming
      return () => clearTimeout(timer);
    }
  }, [isConnected, trackData, broadcastTrack]);

  // Broadcast spectating status when it changes
  useEffect(() => {
    if (isConnected) {
      updateMyState({ isSpectating });
    }
  }, [isSpectating, isConnected, updateMyState]);

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
        <RampsMesh />
        {trackData && <TrackMesh trackData={trackData} />}
        
        {trackData && !isSpectating && <CarMesh trackData={trackData} updateMyState={updateMyState} />}
        {isSpectating && <SpectatorCamera />}
        
        <OtherPlayers players={remotePlayers} />
      </Canvas>
    </div>
  );
}
