import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CarMeshProps {
  curve: THREE.CatmullRomCurve3;
}

export function CarMesh({ curve }: CarMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Keep track of progress along the curve (0 to 1)
  const [progress, setProgress] = useState(0);

  // Reusable vectors to avoid allocations in game loop
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const lookAtPos = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const targetCameraPos = new THREE.Vector3();
  const lookAheadPos = new THREE.Vector3();

  useFrame((_state, delta) => {
    if (!carRef.current) return;

    // Adjust speed (length of track vs delta)
    const speed = 0.05; 
    let nextProgress = progress + speed * delta;
    if (nextProgress > 1) {
      nextProgress = nextProgress % 1; // Loop back
    }
    setProgress(nextProgress);

    // Calculate current point and tangent
    curve.getPointAt(nextProgress, position);
    curve.getTangentAt(nextProgress, tangent).normalize();

    // Set car position and slight hover offset
    carRef.current.position.copy(position);
    carRef.current.position.y += 0.75; // Hover above track

    // Orient the car
    lookAtPos.copy(position).add(tangent);
    carRef.current.lookAt(lookAtPos);

    // Chase camera setup (behind and above)
    cameraOffset.set(0, 4, 12);
    cameraOffset.applyQuaternion(carRef.current.quaternion);
    targetCameraPos.copy(carRef.current.position).add(cameraOffset);

    // Smoothly interpolate camera position for a dynamic, fast-paced feel
    camera.position.lerp(targetCameraPos, 0.1);

    // Camera looks ahead of the car
    lookAheadPos.copy(carRef.current.position).add(tangent.multiplyScalar(20));
    camera.lookAt(lookAheadPos);
  });

  return (
    <group ref={carRef}>
      {/* Sci-fi Hover Car Main Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2.2, 0.6, 4.5]} />
        <meshStandardMaterial color="#00e5ff" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* Cockpit Canopy */}
      <mesh position={[0, 0.5, -0.5]}>
        <boxGeometry args={[1.6, 0.6, 2.2]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={1} />
      </mesh>
      
      {/* Neon Thruster Engine */}
      <mesh position={[0, 0, 2.3]}>
        <boxGeometry args={[1.8, 0.3, 0.2]} />
        <meshBasicMaterial color="#ff0055" />
        <pointLight color="#ff0055" intensity={2} distance={10} />
      </mesh>
    </group>
  );
}
