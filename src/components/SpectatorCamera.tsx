import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { gameStore } from '../store';

export function SpectatorCamera() {
  const { camera } = useThree();
  const [keys, setKeys] = useState<{ [key: string]: boolean }>({});
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  
  useEffect(() => {
    // Reset camera up vector from physics changes
    camera.up.set(0, 1, 0);
    // Point it slightly down to look at the track
    camera.lookAt(camera.position.x, camera.position.y - 5, camera.position.z - 10);
    
    const handleKeyDown = (e: KeyboardEvent) => setKeys((keys) => ({ ...keys, [e.code]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys((keys) => ({ ...keys, [e.code]: false }));

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera]);

  useFrame((_, delta) => {
    // Determine movement direction
    direction.current.set(0, 0, 0);
    
    if (keys['KeyW'] || keys['ArrowUp']) direction.current.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) direction.current.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) direction.current.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) direction.current.x += 1;
    if (keys['Space']) direction.current.y += 1;
    if (keys['KeyC']) direction.current.y -= 1;
    
    direction.current.normalize();

    // Calculate speed based on shift key
    const baseSpeed = 100;
    const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? baseSpeed * 3 : baseSpeed;

    // Apply acceleration and friction
    if (direction.current.lengthSq() > 0) {
      velocity.current.add(direction.current.clone().multiplyScalar(speed * delta));
    }
    
    velocity.current.multiplyScalar(Math.exp(-10 * delta)); // Friction

    // Apply movement relative to camera orientation
    camera.translateX(velocity.current.x * delta);
    camera.translateY(velocity.current.y * delta);
    camera.translateZ(velocity.current.z * delta);
  });

  return (
    <>
      {/* 
        PointerLockControls locks the mouse and rotates the camera. 
        It automatically binds to the document and manages pointer lock state.
      */}
      <PointerLockControls 
        onUnlock={() => {
            // When user hits Esc to unlock pointer, we open the menu
            gameStore.setMenuOpen(true);
        }} 
      />
    </>
  );
}
