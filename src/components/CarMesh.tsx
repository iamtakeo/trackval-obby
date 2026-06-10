import { useRef, useMemo, useEffect, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { CartesianPhysics } from '../engine/CartesianPhysics';
import type { CartesianState, TrackGeometry } from '../engine/CartesianPhysics';
import type { Player } from '../hooks/useMultiplayer';
import type { TrackData } from '../utils/trackGenerator';
import { gameStore } from '../store';

// A simple adapter to allow CartesianPhysics to query the mathematical track spline
class CartesianTrackAdapter implements TrackGeometry {
  curve: THREE.CatmullRomCurve3;
  frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[] };

  constructor(curve: THREE.CatmullRomCurve3, frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[] }) {
    this.curve = curve;
    this.frames = frames;
  }

  getTotalLength(): number {
    return this.curve.getLength();
  }

  private getT(s: number): number {
    const totalLength = this.getTotalLength();
    let t = s / totalLength;
    t = Math.max(0, Math.min(1, t));
    return t;
  }

  private getInterpolatedVector(vectors: THREE.Vector3[], t: number): THREE.Vector3 {
    const floatIndex = t * (vectors.length - 1);
    const index = Math.floor(floatIndex);
    const fraction = floatIndex - index;

    if (index >= vectors.length - 1) return vectors[vectors.length - 1].clone();

    const v1 = vectors[index];
    const v2 = vectors[index + 1];
    return new THREE.Vector3().copy(v1).lerp(v2, fraction).normalize();
  }

  getCartesian(s: number, u: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    const point = this.curve.getPointAt(t);
    // Binormal is used for lateral offset
    const binormal = this.getInterpolatedVector(this.frames.binormals, t);
    return point.add(binormal.multiplyScalar(u));
  }

  getNormal(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.normals, t);
  }

  getBinormal(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.binormals, t);
  }

  getTangent(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.tangents, t);
  }
}

interface CarMeshProps {
  trackData: TrackData;
  updateMyState: (state: Partial<Player>) => void;
}

export function CarMesh({ trackData, updateMyState }: CarMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inputs = useKeyboardControls();
  
  const targetCameraPos = useMemo(() => new THREE.Vector3(), []);
  const lookAheadPos = useMemo(() => new THREE.Vector3(), []);
  const lastBroadcast = useRef(0);

  const carParams = useSyncExternalStore(gameStore.subscribe, gameStore.getCarParameters);

  const physics = useMemo(() => {
    const trackAdapter = new CartesianTrackAdapter(trackData.curve, trackData.frames);
    // Use initial store parameters
    return new CartesianPhysics({ ...gameStore.getCarParameters() }, trackAdapter);
  }, [trackData]);

  // Instantly apply physics parameter changes
  useEffect(() => {
    physics.capabilities = { ...carParams };
  }, [carParams, physics]);

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

  useEffect(() => {
    physicsState.current = getInitialState();
  }, [physics]);


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
    
    // Set up vector (softened lerp for smoother orientation transitions)
    carRef.current.up.lerp(up, 1.0 - Math.exp(-6.0 * dt));
    
    // Calculate dynamic hover offset to prevent long cars from clipping into concave curves
    // up.y is 1.0 on flat ground, approaches 0 on vertical walls
    const slopeOffset = (1.0 - up.y) * 2.5; 
    
    // Simulate suspension by only lerping the Y coordinate, keeping XZ perfectly synced with physics
    carRef.current.position.x = pos.x;
    carRef.current.position.z = pos.z;
    carRef.current.position.y = THREE.MathUtils.lerp(
      carRef.current.position.y, 
      pos.y + 0.75 + slopeOffset, // base hover + slope compensation
      1.0 - Math.exp(-15.0 * dt)
    );

    // Apply heading
    // First, get the flat forward direction
    const flatForward = new THREE.Vector3(Math.sin(newState.heading), 0, Math.cos(newState.heading)).normalize();
    
    // Project the flat forward direction onto the plane defined by the interpolated surface normal
    // right = up x flatForward
    const right = new THREE.Vector3().crossVectors(carRef.current.up, flatForward).normalize();
    // true surface forward = right x up
    const surfaceForward = new THREE.Vector3().crossVectors(right, carRef.current.up).normalize();
    
    // We add the surface forward direction to the position to look at it
    const lookAtPos = carRef.current.position.clone().add(surfaceForward);
    carRef.current.lookAt(lookAtPos);

    // Camera logic
    const distanceBehind = 15;
    const heightAbove = 6;
    
    targetCameraPos.copy(carRef.current.position)
      .sub(surfaceForward.clone().multiplyScalar(distanceBehind))
      .add(carRef.current.up.clone().multiplyScalar(heightAbove));

    camera.position.lerp(targetCameraPos, 1.0 - Math.exp(-5.0 * dt));
    camera.up.lerp(carRef.current.up, 1.0 - Math.exp(-3.0 * dt));

    lookAheadPos.copy(carRef.current.position).add(surfaceForward.clone().multiplyScalar(40));
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
