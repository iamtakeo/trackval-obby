

import { defaultRamps } from '../utils/rampData';

export type Vector3 = { x: number; y: number; z: number };

export interface CartesianState {
  position: Vector3;
  velocity: Vector3; // Forward/Lateral/Up velocities relative to the car, OR just world velocity.
  // Actually, let's keep velocity as a scalar forward speed for simplicity, 
  // and handle gravity separately as a vertical velocity.
  forwardSpeed: number;
  verticalSpeed: number;
  heading: number; // yaw angle in radians. 0 means pointing along Z.
  isGrounded: boolean;
  surfaceNormal: Vector3; // The UP vector of the surface we are driving on
}

export interface CarInputs {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steering: number; // -1 (left) to 1 (right)
  handbrake?: boolean;
}

export interface CartesianCapabilities {
  maxAcceleration: number; // m/s^2
  maxBraking: number;      // m/s^2
  maxVelocity: number;     // m/s
  maxLateralG: number;     // m/s^2
  steeringSensitivity: number; // radians per meter traveled
  gravity: number;         // m/s^2
}

export interface TrackGeometry {
  getTotalLength(): number;
  getCartesian(s: number, u: number): Vector3;
  getNormal(s: number): Vector3;
  getBinormal(s: number): Vector3;
  getTangent(s: number): Vector3;
}

export class CartesianPhysics {
  capabilities: CartesianCapabilities;
  track: TrackGeometry;
  
  // Precomputed track samples for fast closest-point lookups
  private trackSamples: { s: number, pos: Vector3, normal: Vector3, binormal: Vector3 }[] = [];
  private trackWidth = 12;

  constructor(capabilities: CartesianCapabilities, track: TrackGeometry) {
    this.capabilities = capabilities;
    this.track = track;
    this.precomputeTrack();
  }

  private precomputeTrack() {
    const totalLength = this.track.getTotalLength();
    // High resolution sampling (every ~0.2 units) to prevent physics jumpiness at high speeds
    const resolution = Math.max(100, Math.floor(totalLength * 5)); 
    
    for (let i = 0; i <= resolution; i++) {
      const s = (i / resolution) * totalLength;
      this.trackSamples.push({
        s,
        pos: this.track.getCartesian(s, 0),
        normal: this.track.getNormal(s),
        binormal: this.track.getBinormal(s)
      });
    }
  }

  private getClosestTrackSurface(x: number, y: number, z: number): { onTrack: boolean, surfaceY: number, normal: Vector3 } {
    let minDistSq = Infinity;
    let closestIdx = 0;

    // 1. Find the closest discrete sample
    for (let i = 0; i < this.trackSamples.length; i++) {
      const sample = this.trackSamples[i];
      const dx = sample.pos.x - x;
      const dy = sample.pos.y - y;
      const dz = sample.pos.z - z;
      
      const distSq = dx * dx + (dy * dy * 0.1) + dz * dz; 
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestIdx = i;
      }
    }

    // 2. Find the closest neighbor for continuous interpolation
    let neighborIdx = closestIdx;
    if (closestIdx === 0) {
      neighborIdx = 1;
    } else if (closestIdx === this.trackSamples.length - 1) {
      neighborIdx = closestIdx - 1;
    } else {
      const prev = this.trackSamples[closestIdx - 1];
      const next = this.trackSamples[closestIdx + 1];
      const dPrev = Math.pow(prev.pos.x - x, 2) + Math.pow(prev.pos.z - z, 2);
      const dNext = Math.pow(next.pos.x - x, 2) + Math.pow(next.pos.z - z, 2);
      neighborIdx = dPrev < dNext ? closestIdx - 1 : closestIdx + 1;
    }

    const p1 = this.trackSamples[closestIdx];
    const p2 = this.trackSamples[neighborIdx];

    // 3. Project car position onto the line segment between p1 and p2
    const segX = p2.pos.x - p1.pos.x;
    const segY = p2.pos.y - p1.pos.y;
    const segZ = p2.pos.z - p1.pos.z;
    const segLenSq = segX * segX + segY * segY + segZ * segZ;
    
    let t = 0;
    if (segLenSq > 0.0001) {
      const dot = (x - p1.pos.x) * segX + (y - p1.pos.y) * segY * 0.1 + (z - p1.pos.z) * segZ;
      t = Math.max(0, Math.min(1, dot / segLenSq));
    }

    // 4. Calculate the exact, continuous S value
    const exactS = p1.s + t * (p2.s - p1.s);

    // 5. Query the track geometry for perfectly smooth vectors at exactS
    const smoothPos = this.track.getCartesian(exactS, 0);
    const smoothNormal = this.track.getNormal(exactS);

    const dx2d = smoothPos.x - x;
    const dz2d = smoothPos.z - z;
    const dist2d = Math.sqrt(dx2d * dx2d + dz2d * dz2d);

    if (dist2d <= this.trackWidth / 2 + 1.0) {
      const dxPlane = x - smoothPos.x;
      const dzPlane = z - smoothPos.z;
      
      let exactY = smoothPos.y;
      if (Math.abs(smoothNormal.y) > 0.001) {
          exactY = smoothPos.y - (smoothNormal.x * dxPlane + smoothNormal.z * dzPlane) / smoothNormal.y;
      }

      return {
        onTrack: true,
        surfaceY: exactY,
        normal: smoothNormal
      };
    }

    return { onTrack: false, surfaceY: 0, normal: { x: 0, y: 1, z: 0 } };
  }

  step(dt: number, state: CartesianState, inputs: CarInputs): CartesianState {
    const newState = { ...state, position: { ...state.position }, surfaceNormal: { ...state.surfaceNormal } };

    // 1. Throttle / Brake
    let accel = 0;
    if (inputs.throttle > 0) {
      accel = inputs.throttle * this.capabilities.maxAcceleration;
    } else if (inputs.brake > 0) {
      accel = -inputs.brake * this.capabilities.maxBraking;
    }
    
    if (inputs.handbrake && newState.isGrounded) {
      accel -= Math.sign(newState.forwardSpeed) * this.capabilities.maxBraking * 0.3;
    }

    // Apply drag based on velocity square
    const speedRatio = Math.abs(newState.forwardSpeed) / this.capabilities.maxVelocity;
    const drag = Math.sign(newState.forwardSpeed) * this.capabilities.maxAcceleration * (speedRatio * speedRatio);
    accel -= drag;

    newState.forwardSpeed += accel * dt;
    
    // Hard cap max velocity
    newState.forwardSpeed = Math.max(-this.capabilities.maxVelocity * 0.2, Math.min(newState.forwardSpeed, this.capabilities.maxVelocity));

    // 2. Steering
    // The car can turn if it is moving. We add a minimum effective speed so low-speed turning isn't sluggish.
    let effectiveSpeedForSteering = Math.abs(newState.forwardSpeed);
    if (effectiveSpeedForSteering > 0.1) {
      effectiveSpeedForSteering = Math.max(effectiveSpeedForSteering, 60); // Minimum arcade turn rate
    }
    
    // Reverse steering direction if driving backwards
    const direction = Math.sign(newState.forwardSpeed) >= 0 ? 1 : -1;
    
    let currentSensitivity = this.capabilities.steeringSensitivity;
    if (inputs.handbrake && Math.abs(newState.forwardSpeed) > 10) {
       // Handbrake drifting increases turn rate!
       currentSensitivity *= 1.5; 
    }
    
    const turnRadiusEffect = effectiveSpeedForSteering * currentSensitivity;
    // inputs.steering is -1 (Left) to 1 (Right).
    // In our 3D world, right turn means decreasing yaw angle (negative rotation around Y)
    newState.heading -= inputs.steering * direction * turnRadiusEffect * dt;

    // 3. X/Z Movement
    // Heading 0 means pointing along positive Z? 
    // In Three.js, Math.sin(heading) and Math.cos(heading) define direction.
    // Let's standardise: Z is forward.
    const vx = Math.sin(newState.heading) * newState.forwardSpeed;
    const vz = Math.cos(newState.heading) * newState.forwardSpeed;

    newState.position.x += vx * dt;
    newState.position.z += vz * dt;

    // 4. Track Collision & Gravity
    const surfaceInfo = this.getClosestTrackSurface(newState.position.x, newState.position.y, newState.position.z);
    
    // We also check the ground plane at y = 0
    let targetSurfaceY = 0;
    let targetNormal = { x: 0, y: 1, z: 0 };
    
    // Check ramps
    for (const ramp of defaultRamps) {
      const dx = newState.position.x - ramp.position[0];
      const dz = newState.position.z - ramp.position[2];
      
      // Inverse rotation to local space
      const localX = dx * Math.cos(-ramp.rotation) - dz * Math.sin(-ramp.rotation);
      const localZ = dx * Math.sin(-ramp.rotation) + dz * Math.cos(-ramp.rotation);
      
      // Ramp bounding box
      if (localX >= -ramp.width / 2 && localX <= ramp.width / 2 && localZ >= 0 && localZ <= ramp.length) {
         const rampY = ramp.position[1] + (localZ / ramp.length) * ramp.height;
         // Only apply if the car is physically near or above the surface
         if (rampY > targetSurfaceY && newState.position.y >= rampY - 2.0) {
            targetSurfaceY = rampY;
            const slope = Math.atan2(ramp.height, ramp.length);
            const normalLocalY = Math.cos(slope);
            const normalLocalZ = -Math.sin(slope); // Tilt backwards along local Z
            
            targetNormal = {
               x: normalLocalZ * Math.sin(ramp.rotation),
               y: normalLocalY,
               z: normalLocalZ * Math.cos(ramp.rotation)
            };
         }
      }
    }
    
    if (surfaceInfo.onTrack && newState.position.y >= surfaceInfo.surfaceY - 2.0) {
      // Car is above or slightly below track surface (allow small margin for snapping)
      targetSurfaceY = surfaceInfo.surfaceY;
      targetNormal = surfaceInfo.normal;
    }

    // Apply gravity
    newState.verticalSpeed -= this.capabilities.gravity * dt;
    newState.position.y += newState.verticalSpeed * dt;

    // Ground Collision
    if (newState.position.y <= targetSurfaceY) {
      newState.position.y = targetSurfaceY;
      newState.verticalSpeed = 0;
      newState.isGrounded = true;
      newState.surfaceNormal = targetNormal;
      
      // Slight friction if grounded but no throttle (optional)
      if (inputs.throttle === 0 && inputs.brake === 0) {
          newState.forwardSpeed *= Math.exp(-0.5 * dt);
      }
    } else {
      newState.isGrounded = false;
      // When airborne, align upright
      newState.surfaceNormal = { x: 0, y: 1, z: 0 };
    }

    return newState;
  }
}
