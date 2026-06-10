import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { KinematicPhysics } from '../engine/KinematicPhysics';
import type { CarCapabilities, PhysicsState, TrackGeometry } from '../engine/KinematicPhysics';
import { gameStore } from '../store';

interface CarMeshProps {
  curve: THREE.CatmullRomCurve3;
  updateMyState?: (stateUpdate: any) => void;
}

type FrenetFrames = { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[] };

class ThreeJSTrackAdapter implements TrackGeometry {
  curve: THREE.CatmullRomCurve3;
  frames: FrenetFrames;
  length: number;

  constructor(curve: THREE.CatmullRomCurve3, frames: FrenetFrames, length: number) {
    this.curve = curve;
    this.frames = frames;
    this.length = length;
  }

  getTotalLength(): number { return this.length; }
  getWidth(): number { return 12; } // Fixed 12m width based on TrackMesh Shape

  private getT(s: number): number {
    let u = s / this.length;
    if (this.curve.closed) {
      u = ((u % 1) + 1) % 1; // Wrap around safely
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
    const normal = this.getInterpolatedVector(this.frames.normals, t);
    // Move laterally across the track width
    return point.add(normal.multiplyScalar(u));
  }

  getTangent(s: number) { return this.getInterpolatedVector(this.frames.tangents, this.getT(s)); }
  getNormal(s: number) { return this.getInterpolatedVector(this.frames.normals, this.getT(s)); }
  getBinormal(s: number) { return this.getInterpolatedVector(this.frames.binormals, this.getT(s)); }

  projectToTrack() {
    // Simplification for now: Airborne cars won't land automatically in this MVP.
    return { onTrack: false, s: 0, u: 0 };
  }
}

export function CarMesh({ curve, updateMyState }: CarMeshProps) {
  const carRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const inputs = useKeyboardControls();
  
  // Reusable vectors to avoid allocations in game loop
  const lookAtPos = useMemo(() => new THREE.Vector3(), []);
  const cameraOffset = useMemo(() => new THREE.Vector3(), []);
  const targetCameraPos = useMemo(() => new THREE.Vector3(), []);
  const lookAheadPos = useMemo(() => new THREE.Vector3(), []);

  // Throttle network broadcasts
  const lastBroadcast = useRef(0);

  // Initialize Physics Engine
  const physics = useMemo(() => {
    const frames = curve.computeFrenetFrames(400, false);
    const trackAdapter = new ThreeJSTrackAdapter(curve, frames, curve.getLength());
    
    const capabilities: CarCapabilities = {
      maxAcceleration: 30, // snappy arcade acceleration
      maxBraking: 50,
      maxVelocity: 150, // u/s
      maxLateralG: 40,
      mass: 1000,
      gravity: 30
    };
    return new KinematicPhysics(capabilities, trackAdapter);
  }, [curve]);

  // Keep track of physics state between frames
  const physicsState = useRef<PhysicsState>({
    type: 'grounded',
    s: 0,
    u: 0,
    sDot: 0,
    uDot: 0
  });

  useFrame((state, delta) => {
    if (!carRef.current) return;

    // Cap delta to prevent huge jumps if tab was inactive
    const dt = Math.min(delta, 0.1);

    // 1. Step the physics engine
    let newState = physics.step(dt, physicsState.current, inputs);

    // Track looping logic: keep s wrapped within total length
    if (newState.type === 'grounded' && curve.closed) {
      newState.s = newState.s % physics.track.getTotalLength();
      if (newState.s < 0) newState.s += physics.track.getTotalLength();
      
      // Auto-recover if we drove off the edge (simplify gameplay for now)
      if (Math.abs(newState.u) > 6.5) { // Track is 12 wide (-6 to 6). Give 0.5 buffer.
        newState.u = Math.sign(newState.u) * 6;
        newState.uDot = 0;
      }

      gameStore.setSpeed(Math.round(newState.sDot));
    }
    
    physicsState.current = newState;

    // 2. Render State to 3D Space
    if (newState.type === 'grounded') {
      const pos = physics.track.getCartesian(newState.s, newState.u) as THREE.Vector3;
      const tangent = physics.track.getTangent(newState.s) as THREE.Vector3;
      const binormal = physics.track.getBinormal(newState.s) as THREE.Vector3;

      // We align the car's 'up' vector to match the track's surface normal (binormal).
      carRef.current.up.copy(binormal);

      // Set car position and slight hover offset ALONG the binormal (track up vector)
      carRef.current.position.copy(pos).add(binormal.clone().multiplyScalar(0.75));

      // Orient the car to look forward along the tangent
      lookAtPos.copy(carRef.current.position).add(tangent);
      carRef.current.lookAt(lookAtPos);

      // Camera logic
      cameraOffset.set(0, 4, 12);
      cameraOffset.applyQuaternion(carRef.current.quaternion);
      targetCameraPos.copy(carRef.current.position).add(cameraOffset);
      camera.position.lerp(targetCameraPos, 0.1);
      lookAheadPos.copy(carRef.current.position).add(tangent.clone().multiplyScalar(20));
      camera.lookAt(lookAheadPos);

      // Network Broadcast (Throttled to ~15 Hz)
      if (updateMyState && state.clock.elapsedTime - lastBroadcast.current > 1 / 15) {
        lastBroadcast.current = state.clock.elapsedTime;
        updateMyState({
          position: [carRef.current.position.x, carRef.current.position.y, carRef.current.position.z],
          rotation: [carRef.current.rotation.x, carRef.current.rotation.y, carRef.current.rotation.z]
        });
      }
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
