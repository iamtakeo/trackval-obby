import { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { CartesianState, TrackGeometry } from '../engine/CartesianPhysics';
import { CartesianPhysics } from '../engine/CartesianPhysics';
import { CartesianTrackAdapter } from '../engine/CartesianTrackAdapter';
import type { TrackData } from '../utils/trackGenerator';
import { gameStore } from '../store';
import { CarModel } from './CarModel';

interface BotSwarmProps {
  trackData: TrackData;
}

class BotAI {
  physics: CartesianPhysics;
  state: CartesianState;
  id: string;
  isFailed: boolean = false;
  failedReason: 'FellOff' | 'Stuck' | 'Success' | null = null;
  timeSinceLastProgress: number = 0;
  lastS: number = 0;

  constructor(id: string, adapter: TrackGeometry) {
    this.id = id;
    this.physics = new CartesianPhysics(gameStore.getCarParameters(), adapter);
    
    // Spawn with a slight random offset
    const startPoint = adapter.getCartesian(0, (Math.random() - 0.5) * 5);
    const startNormal = adapter.getNormal(0);
    const startTangent = adapter.getTangent(0);
    
    this.state = {
      position: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
      velocity: { x: 0, y: 0, z: 0 },
      forwardSpeed: 0,
      verticalSpeed: 0,
      carDirection: { x: startTangent.x, y: startTangent.y, z: startTangent.z },
      surfaceNormal: { x: startNormal.x, y: startNormal.y, z: startNormal.z },
      isGrounded: true
    };
  }

  reset(adapter: TrackGeometry) {
    const startPoint = adapter.getCartesian(0, (Math.random() - 0.5) * 5);
    const startNormal = adapter.getNormal(0);
    const startTangent = adapter.getTangent(0);
    this.state.position = { x: startPoint.x, y: startPoint.y, z: startPoint.z };
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.forwardSpeed = 0;
    this.state.verticalSpeed = 0;
    this.state.carDirection = { x: startTangent.x, y: startTangent.y, z: startTangent.z };
    this.state.surfaceNormal = { x: startNormal.x, y: startNormal.y, z: startNormal.z };
    this.state.isGrounded = true;
    this.isFailed = false;
    this.failedReason = null;
    this.timeSinceLastProgress = 0;
    this.lastS = 0;
  }
}

export function BotSwarm({ trackData }: BotSwarmProps) {
  const [active, setActive] = useState(gameStore.getBotSimulationActive());
  const [botCount, setBotCount] = useState(gameStore.getBotCount());
  
  // Track adapter
  const adapter = useMemo(() => {
    return new CartesianTrackAdapter(trackData.curve, trackData.frames);
  }, [trackData]);

  // Manage bots
  const botsRef = useRef<BotAI[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const unsubscribe = gameStore.subscribe(() => {
      setActive(gameStore.getBotSimulationActive());
      setBotCount(gameStore.getBotCount());
    });
    return unsubscribe;
  }, []);

  // Sync bot array length
  useEffect(() => {
    if (!active) {
      botsRef.current = [];
      gameStore.setBotStats({ active: 0 });
      return;
    }
    
    const currentCount = botsRef.current.length;
    if (currentCount < botCount) {
      for (let i = currentCount; i < botCount; i++) {
        botsRef.current.push(new BotAI(`bot_${Math.random().toString(36).substr(2, 9)}`, adapter));
      }
    } else if (currentCount > botCount) {
      botsRef.current = botsRef.current.slice(0, botCount);
    }
    gameStore.setBotStats({ active: botsRef.current.length });
  }, [active, botCount, adapter]);

  useFrame((_, delta) => {
    if (!active) return;
    
    let successes = 0;
    let fails = 0;

    botsRef.current.forEach((bot) => {
      if (bot.isFailed) {
        // Just reset them immediately for continuous validation
        bot.reset(adapter);
        return;
      }

      // Just use the bot's raw progress as an approximation, or fallback to 0
      // In a real headless 1D simulation we'd have `s`, but since we use CartesianPhysics, we need to extract `s` from the adapter.
      // Wait, let's just keep track of distance traveled using forwardSpeed.
      const s = bot.lastS + bot.state.forwardSpeed * delta;
      
      // Check success
      if (s >= adapter.getTotalLength() - 10) {
        bot.isFailed = true;
        bot.failedReason = 'Success';
        gameStore.addTelemetry({ id: bot.id, position: { ...bot.state.position }, reason: 'Success' });
        successes++;
        return;
      }

      // Check failure: Fell off
      if (!bot.state.isGrounded && bot.state.position.y < -50) {
        bot.isFailed = true;
        bot.failedReason = 'FellOff';
        gameStore.addTelemetry({ id: bot.id, position: { ...bot.state.position }, reason: 'FellOff' });
        fails++;
        return;
      }

      // Check failure: Stuck
      if (s - bot.lastS < 0.5) {
        bot.timeSinceLastProgress += delta;
        if (bot.timeSinceLastProgress > 3) {
          bot.isFailed = true;
          bot.failedReason = 'Stuck';
          gameStore.addTelemetry({ id: bot.id, position: { ...bot.state.position }, reason: 'Stuck' });
          fails++;
          return;
        }
      } else {
        bot.timeSinceLastProgress = 0;
        bot.lastS = s;
      }

      // Lookahead curvature analysis
      const lookaheadDist = Math.max(20, bot.state.forwardSpeed * 1.5);
      const targetS = Math.min(s + lookaheadDist, adapter.getTotalLength());
      
      const currentTangent = adapter.getTangent(s);
      const targetTangent = adapter.getTangent(targetS);
      const currentTangentVec = new THREE.Vector3(currentTangent.x, currentTangent.y, currentTangent.z);
      const targetTangentVec = new THREE.Vector3(targetTangent.x, targetTangent.y, targetTangent.z);
      const angleDiff = currentTangentVec.angleTo(targetTangentVec);
      
      // Calculate max safe speed roughly
      const curveSharpness = angleDiff / lookaheadDist; // radians per meter
      const maxLatG = gameStore.getCarParameters().maxLateralG;
      // a = v^2 * curveSharpness -> v = sqrt(a / curveSharpness)
      const maxSafeSpeed = curveSharpness > 0.001 ? Math.sqrt(maxLatG / curveSharpness) : 1000;
      
      let throttle = 0;
      let brake = 0;
      if (bot.state.forwardSpeed > maxSafeSpeed * 0.9) {
        brake = 1;
      } else {
        throttle = 1;
      }

      // Steering (Stanley Controller approximation)
      const targetPoint = adapter.getCartesian(targetS, 0); // Aim for center
      // Localize target point
      const toTarget = new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z).sub(new THREE.Vector3(bot.state.position.x, bot.state.position.y, bot.state.position.z));
      // Project onto local X axis (cross product of normal and direction)
      const botDirVec = new THREE.Vector3(bot.state.carDirection.x, bot.state.carDirection.y, bot.state.carDirection.z);
      const botNormVec = new THREE.Vector3(bot.state.surfaceNormal.x, bot.state.surfaceNormal.y, bot.state.surfaceNormal.z);
      const localRight = botDirVec.cross(botNormVec).normalize();
      const lateralError = toTarget.dot(localRight);
      
      // Basic P controller
      let steering = lateralError * 0.1;
      steering = Math.max(-1, Math.min(1, steering));

      // --- Physics Step ---
      bot.state = bot.physics.step(delta, bot.state, {
        throttle,
        brake,
        steering,
        handbrake: false
      });
    });

    // Update stats if changed
    if (successes > 0 || fails > 0) {
      const stats = gameStore.getBotStats();
      gameStore.setBotStats({
        success: stats.success + successes,
        fail: stats.fail + fails
      });
    }

    // --- Render Update ---
    if (groupRef.current) {
      botsRef.current.forEach((bot, index) => {
        const child = groupRef.current!.children[index];
        if (child) {
          child.position.set(bot.state.position.x, bot.state.position.y, bot.state.position.z);
          
          // Calculate rotation
          const dirVec = new THREE.Vector3(bot.state.carDirection.x, bot.state.carDirection.y, bot.state.carDirection.z);
          const normVec = new THREE.Vector3(bot.state.surfaceNormal.x, bot.state.surfaceNormal.y, bot.state.surfaceNormal.z);
          const right = dirVec.cross(normVec).normalize();
          const forward = new THREE.Vector3().crossVectors(normVec, right).normalize();
          const matrix = new THREE.Matrix4().makeBasis(right, normVec, forward);
          child.quaternion.setFromRotationMatrix(matrix);
        }
      });
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {botsRef.current.map((bot) => (
        <group key={bot.id}>
          <CarModel 
            appearance={{
              bodyStyle: 'speedster',
              primaryColor: '#ff0055',
              secondaryColor: '#ffffff',
              thrusterColor: '#ff0055',
              decalStyle: 'none',
              spoiler: 'none',
              underglow: false,
              underglowColor: '#000000',
              accessory: 'none'
            }}
            isGhost={true} 
          />
        </group>
      ))}
    </group>
  );
}
