import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
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
      {/* Sci-fi Hover Car Main Body - Ghostly Appearance */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 0.6, 4.5]} />
        <meshStandardMaterial 
          color={player.color || "#ffaa00"} 
          roughness={0.2} 
          metalness={0.9} 
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Cockpit Canopy */}
      <mesh position={[0, 0.5, -0.5]}>
        <boxGeometry args={[1.6, 0.6, 2.2]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={1} transparent opacity={0.6} />
      </mesh>
      
      {/* Neon Thruster Engine */}
      <mesh position={[0, 0, 2.3]}>
        <boxGeometry args={[1.8, 0.3, 0.2]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function OtherPlayers({ players }: OtherPlayersProps) {
  return (
    <group>
      {Object.values(players).map((p) => (
        <RemoteCar key={p.id} player={p} />
      ))}
    </group>
  );
}
