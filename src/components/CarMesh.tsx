import { useRef, useMemo, useEffect, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { CartesianPhysics } from '../engine/CartesianPhysics';
import type { CartesianState, TrackGeometry } from '../engine/CartesianPhysics';
import type { Player } from '../hooks/useMultiplayer';
import type { TrackData } from '../utils/trackGenerator';
import { gameStore } from '../store';
import { CarModel } from './CarModel';

// A simple adapter to allow CartesianPhysics to query the mathematical track spline
class CartesianTrackAdapter implements TrackGeometry {
  curve: THREE.Curve<THREE.Vector3>;
  frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[], widths: number[] };

  constructor(curve: THREE.Curve<THREE.Vector3>, frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[], widths: number[] }) {
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

  getWidth(s: number): number {
    const t = this.getT(s);
    const floatIndex = t * (this.frames.widths.length - 1);
    const index = Math.floor(floatIndex);
    const fraction = floatIndex - index;

    if (index >= this.frames.widths.length - 1) return this.frames.widths[this.frames.widths.length - 1];

    const w1 = this.frames.widths[index];
    const w2 = this.frames.widths[index + 1];
    return w1 + (w2 - w1) * fraction;
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
  const carAppearance = useSyncExternalStore(gameStore.subscribe, gameStore.getCarAppearance);

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
    
    return {
      position: { x: startPos.x, y: startPos.y + 1.0, z: startPos.z }, // spawn within physics snapping range
      velocity: { x: 0, y: 0, z: 0 },
      forwardSpeed: 0,
      verticalSpeed: 0,
      carDirection: { x: startTangent.x, y: startTangent.y, z: startTangent.z }, // align with track forward
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
    // Math.max(0, ...) ensures we don't apply negative offsets when upside down
    const slopeOffset = Math.max(0, 1.0 - up.y) * 2.5; 
    const hoverDist = 0.75 + slopeOffset;
    
    const targetPos = new THREE.Vector3(
        pos.x + up.x * hoverDist,
        pos.y + up.y * hoverDist,
        pos.z + up.z * hoverDist
    );
    
    // Simulate suspension by lerping the full 3D position towards the target hover spot
    carRef.current.position.lerp(targetPos, 1.0 - Math.exp(-15.0 * dt));
    
    // Hard clamp distance to physics pos to prevent visual lagging
    const distToPhysicsSq = carRef.current.position.distanceToSquared(pos);
    if (distToPhysicsSq > 25.0) { // 5 units
        carRef.current.position.copy(targetPos);
    }

    // Apply heading
    const surfaceForward = new THREE.Vector3(newState.carDirection.x, newState.carDirection.y, newState.carDirection.z);
    
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
      <CarModel appearance={carAppearance} isGhost={false} />
    </group>
  );
}
