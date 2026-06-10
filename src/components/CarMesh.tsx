import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { CartesianPhysics } from '../engine/CartesianPhysics';
import type { CartesianCapabilities, CartesianState, TrackGeometry } from '../engine/CartesianPhysics';
import { gameStore } from '../store';

interface CarMeshProps {
  curve: THREE.CatmullRomCurve3;
  updateMyState?: (stateUpdate: any) => void;
}

type FrenetFrames = { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[] };

class CartesianTrackAdapter implements TrackGeometry {
  curve: THREE.CatmullRomCurve3;
  frames: FrenetFrames;
  length: number;

  constructor(curve: THREE.CatmullRomCurve3, frames: FrenetFrames, length: number) {
    this.curve = curve;
    this.frames = frames;
    this.length = length;
  }

  getTotalLength(): number { return this.length; }

  private getT(s: number): number {
    let u = s / this.length;
    if (this.curve.closed) {
      u = ((u % 1) + 1) % 1; 
    } else {
      u = Math.max(0, Math.min(1, u));
    }
    return u;
  }

  private getInterpolatedVector(array: THREE.Vector3[], t: number): THREE.Vector3 {
    const segments = array.length - 1;
    const index = t * segments;
    const i = Math.floor(index);
    const f = index - i;
    const nextI = Math.min(i + 1, segments);
    return new THREE.Vector3().copy(array[i]).lerp(array[nextI], f).normalize();
  }

  getCartesian(s: number, u: number) {
    const t = this.getT(s);
    const point = this.curve.getPointAt(t);
    const binormal = this.getInterpolatedVector(this.frames.binormals, t);
    return point.add(binormal.multiplyScalar(u));
  }

  getTangent(s: number) { return this.getInterpolatedVector(this.frames.tangents, this.getT(s)); }
  getNormal(s: number) { return this.getInterpolatedVector(this.frames.normals, this.getT(s)); }
  getBinormal(s: number) { return this.getInterpolatedVector(this.frames.binormals, this.getT(s)); }
}

export function CarMesh({ curve, updateMyState }: CarMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inputs = useKeyboardControls();
  
  const targetCameraPos = useMemo(() => new THREE.Vector3(), []);
  const lookAheadPos = useMemo(() => new THREE.Vector3(), []);
  const lastBroadcast = useRef(0);

  const physics = useMemo(() => {
    const frames = curve.computeFrenetFrames(400, false);
    const trackAdapter = new CartesianTrackAdapter(curve, frames, curve.getLength());
    
    const capabilities: CartesianCapabilities = {
      maxAcceleration: 40, 
      maxBraking: 60,
      maxVelocity: 150, 
      maxLateralG: 40,
      steeringSensitivity: 0.015, // Radian turn per meter traveled
      gravity: 50 // m/s^2
    };
    return new CartesianPhysics(capabilities, trackAdapter);
  }, [curve]);

  const getInitialState = (): CartesianState => {
    const startPos = physics.track.getCartesian(0, 0);
    const startTangent = physics.track.getTangent(0);
    // heading 0 means +Z. In Three.js Math.atan2(x, z) gives angle where sin=x, cos=z
    const startHeading = Math.atan2(startTangent.x, startTangent.z);
    
    return {
      position: { x: startPos.x, y: startPos.y + 5, z: startPos.z }, // drop from slightly above
      velocity: { x: 0, y: 0, z: 0 },
      forwardSpeed: 0,
      verticalSpeed: 0,
      heading: startHeading,
      isGrounded: false,
      surfaceNormal: { x: 0, y: 1, z: 0 }
    };
  };

  const physicsState = useRef<CartesianState>(getInitialState());

  useFrame((state, delta) => {
    if (!carRef.current) return;

    const dt = Math.min(delta, 0.1);

    // Respawn Logic
    if (inputs.respawn) {
      physicsState.current = getInitialState();
    }

    // Step physics
    const newState = physics.step(dt, physicsState.current, inputs);
    physicsState.current = newState;
    
    // Update game store for HUD
    gameStore.setSpeed(Math.round(newState.forwardSpeed));

    // Render State
    const pos = newState.position;
    const up = new THREE.Vector3(newState.surfaceNormal.x, newState.surfaceNormal.y, newState.surfaceNormal.z);
    
    // Set up vector and position
    carRef.current.up.lerp(up, 1.0 - Math.exp(-10.0 * dt));
    carRef.current.position.set(pos.x, pos.y + 0.75, pos.z); // hover offset

    // Apply heading
    // The car should point along its heading vector
    const headingDir = new THREE.Vector3(Math.sin(newState.heading), 0, Math.cos(newState.heading)).normalize();
    
    // We add the heading direction to the position to look at it
    const lookAtPos = carRef.current.position.clone().add(headingDir);
    carRef.current.lookAt(lookAtPos);

    // Camera logic
    const distanceBehind = 15;
    const heightAbove = 6;
    
    targetCameraPos.copy(carRef.current.position)
      .sub(headingDir.clone().multiplyScalar(distanceBehind))
      .add(carRef.current.up.clone().multiplyScalar(heightAbove));

    camera.position.lerp(targetCameraPos, 1.0 - Math.exp(-5.0 * dt));
    camera.up.lerp(carRef.current.up, 1.0 - Math.exp(-3.0 * dt));

    lookAheadPos.copy(carRef.current.position).add(headingDir.clone().multiplyScalar(40));
    camera.lookAt(lookAheadPos);

    // Network Broadcast
    if (updateMyState && state.clock.elapsedTime - lastBroadcast.current > 1 / 15) {
      lastBroadcast.current = state.clock.elapsedTime;
      updateMyState({
        position: [carRef.current.position.x, carRef.current.position.y, carRef.current.position.z],
        rotation: [carRef.current.rotation.x, carRef.current.rotation.y, carRef.current.rotation.z]
      });
    }
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
