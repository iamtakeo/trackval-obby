import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CarModel } from './CarModel';
import type { CarAppearance } from '../store';

interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  appearance?: CarAppearance;
  isSpectating?: boolean;
}

interface OtherPlayersProps {
  players: Record<string, Player>;
}

function RemoteCar({ player }: { player: Player }) {
  const meshRef = useRef<THREE.Group>(null);
  
  // Create a reusable vector and euler for smooth interpolation
  const targetPos = useRef(new THREE.Vector3());
  const targetRot = useRef(new THREE.Euler());
  const targetQuat = useRef(new THREE.Quaternion());

  useFrame(() => {
    if (!meshRef.current) return;
    
    // Update targets from network state
    targetPos.current.set(player.position[0], player.position[1], player.position[2]);
    targetRot.current.set(player.rotation[0], player.rotation[1], player.rotation[2]);
    targetQuat.current.setFromEuler(targetRot.current);
    
    // Smoothly interpolate position and rotation to hide network jitter
    meshRef.current.position.lerp(targetPos.current, 0.3);
    meshRef.current.quaternion.slerp(targetQuat.current, 0.3);
  });

  return (
    <group ref={meshRef}>
      <CarModel appearance={player.appearance} isGhost={true} />
    </group>
  );
}

export function OtherPlayers({ players }: OtherPlayersProps) {
  return (
    <group>
      {Object.values(players)
        .filter(p => !p.isSpectating)
        .map((p) => (
          <RemoteCar key={p.id} player={p} />
      ))}
    </group>
  );
}
