

import { defaultRamps } from '../utils/rampData';

export type Vector3 = { x: number; y: number; z: number };

export interface CartesianState {
  position: Vector3;
  velocity: Vector3; // Forward/Lateral/Up velocities relative to the car, OR just world velocity.
  // Actually, let's keep velocity as a scalar forward speed for simplicity, 
  // and handle gravity separately as a vertical velocity.
  forwardSpeed: number;
  verticalSpeed: number;
  carDirection: Vector3; // The true 3D vector of the car's heading
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

  private getClosestTrackSurface(x: number, y: number, z: number): { onTrack: boolean, exactPos: Vector3, normal: Vector3, binormal: Vector3, tangent: Vector3 } {
    let minDistSq = Infinity;
    let closestIdx = 0;

    // 1. Find the closest discrete sample (Full 3D)
    for (let i = 0; i < this.trackSamples.length; i++) {
      const sample = this.trackSamples[i];
      const dx = sample.pos.x - x;
      const dy = sample.pos.y - y;
      const dz = sample.pos.z - z;
      
      const distSq = dx * dx + dy * dy + dz * dz; 
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
      const dPrev = Math.pow(prev.pos.x - x, 2) + Math.pow(prev.pos.y - y, 2) + Math.pow(prev.pos.z - z, 2);
      const dNext = Math.pow(next.pos.x - x, 2) + Math.pow(next.pos.y - y, 2) + Math.pow(next.pos.z - z, 2);
      neighborIdx = dPrev < dNext ? closestIdx - 1 : closestIdx + 1;
    }

    const p1 = this.trackSamples[closestIdx];
    const p2 = this.trackSamples[neighborIdx];

    // 3. Project car position onto the line segment between p1 and p2 (Full 3D)
    const segX = p2.pos.x - p1.pos.x;
    const segY = p2.pos.y - p1.pos.y;
    const segZ = p2.pos.z - p1.pos.z;
    const segLenSq = segX * segX + segY * segY + segZ * segZ;
    
    let t = 0;
    if (segLenSq > 0.0001) {
      const dot = (x - p1.pos.x) * segX + (y - p1.pos.y) * segY + (z - p1.pos.z) * segZ;
      t = Math.max(0, Math.min(1, dot / segLenSq));
    }

    // 4. Calculate the exact, continuous S value
    const exactS = p1.s + t * (p2.s - p1.s);

    // 5. Query the track geometry for perfectly smooth vectors at exactS
    const smoothPos = this.track.getCartesian(exactS, 0);
    const smoothNormal = this.track.getNormal(exactS);
    const smoothBinormal = this.track.getBinormal(exactS);
    const smoothTangent = this.track.getTangent(exactS);

    // Distance in the lateral plane (binormal)
    const dxPlane = x - smoothPos.x;
    const dyPlane = y - smoothPos.y;
    const dzPlane = z - smoothPos.z;
    
    const lateralDist = Math.abs(dxPlane * smoothBinormal.x + dyPlane * smoothBinormal.y + dzPlane * smoothBinormal.z);

    if (lateralDist <= this.trackWidth / 2 + 1.0) {
      return {
        onTrack: true,
        exactPos: smoothPos,
        normal: smoothNormal,
        binormal: smoothBinormal,
        tangent: smoothTangent
      };
    }

    return { 
      onTrack: false, 
      exactPos: { x: 0, y: 0, z: 0 }, 
      normal: { x: 0, y: 1, z: 0 },
      binormal: { x: 1, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 }
    };
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

    const speedRatio = Math.abs(newState.forwardSpeed) / this.capabilities.maxVelocity;
    const drag = Math.sign(newState.forwardSpeed) * this.capabilities.maxAcceleration * (speedRatio * speedRatio);
    accel -= drag;

    newState.forwardSpeed += accel * dt;
    newState.forwardSpeed = Math.max(-this.capabilities.maxVelocity * 0.2, Math.min(newState.forwardSpeed, this.capabilities.maxVelocity));

    // Helper for 3D rotation (Rodrigues' rotation formula)
    const rotateVector = (v: Vector3, k: Vector3, theta: number): Vector3 => {
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const kxv = {
            x: k.y * v.z - k.z * v.y,
            y: k.z * v.x - k.x * v.z,
            z: k.x * v.y - k.y * v.x
        };
        const kdotv = k.x * v.x + k.y * v.y + k.z * v.z;
        return {
            x: v.x * cosT + kxv.x * sinT + k.x * kdotv * (1 - cosT),
            y: v.y * cosT + kxv.y * sinT + k.y * kdotv * (1 - cosT),
            z: v.z * cosT + kxv.z * sinT + k.z * kdotv * (1 - cosT)
        };
    };

    // 2. Steering
    let effectiveSpeedForSteering = Math.abs(newState.forwardSpeed);
    if (effectiveSpeedForSteering > 0.1) {
      effectiveSpeedForSteering = Math.max(effectiveSpeedForSteering, 60);
    }
    // Floor limit for low-speed maneuvering
    effectiveSpeedForSteering = Math.max(5, effectiveSpeedForSteering);
    const direction = Math.sign(newState.forwardSpeed) >= 0 ? 1 : -1;
    let currentSensitivity = this.capabilities.steeringSensitivity;
    if (inputs.handbrake && Math.abs(newState.forwardSpeed) > 10) {
       currentSensitivity *= 1.5; 
    }
    const turnRadiusEffect = effectiveSpeedForSteering * currentSensitivity;
    
    // Rotate carDirection around surfaceNormal
    if (inputs.steering !== 0) {
        const angle = -inputs.steering * direction * turnRadiusEffect * dt;
        newState.carDirection = rotateVector(newState.carDirection, newState.surfaceNormal, angle);
    }

    // 3. Environment Query
    const surfaceInfo = this.getClosestTrackSurface(newState.position.x, newState.position.y, newState.position.z);
    
    let targetNormal = { x: 0, y: 1, z: 0 };
    let targetBinormal = { x: 1, y: 0, z: 0 };
    let isTrackSurface = false;
    let distToSurface = 0;
    let exactPos = { x: newState.position.x, y: 0, z: newState.position.z };

    if (surfaceInfo.onTrack) {
        const dx = newState.position.x - surfaceInfo.exactPos.x;
        const dy = newState.position.y - surfaceInfo.exactPos.y;
        const dz = newState.position.z - surfaceInfo.exactPos.z;
        distToSurface = dx * surfaceInfo.normal.x + dy * surfaceInfo.normal.y + dz * surfaceInfo.normal.z;
        
        // Snapping range
        if (Math.abs(distToSurface) < 3.0 || (state.isGrounded && Math.abs(distToSurface) < 6.0)) {
            isTrackSurface = true;
            targetNormal = surfaceInfo.normal;
            targetBinormal = surfaceInfo.binormal;
            exactPos = surfaceInfo.exactPos;
        }
    }

    // Ground plane fallback
    if (!isTrackSurface && newState.position.y <= 0.5) {
        isTrackSurface = true;
        targetNormal = { x: 0, y: 1, z: 0 };
        exactPos = { x: newState.position.x, y: 0, z: newState.position.z };
        distToSurface = newState.position.y;
    }

    // Check ramps
    for (const ramp of defaultRamps) {
      const dxRamp = newState.position.x - ramp.position[0];
      const dzRamp = newState.position.z - ramp.position[2];
      
      const localX = dxRamp * Math.cos(ramp.rotation) - dzRamp * Math.sin(ramp.rotation);
      const localZ = dxRamp * Math.sin(ramp.rotation) + dzRamp * Math.cos(ramp.rotation);
      
      if (localX >= -ramp.width / 2 && localX <= ramp.width / 2 && localZ >= 0 && localZ <= ramp.length) {
         const t = localZ / ramp.length;
         const curveT = t * t;
         const rampY = ramp.position[1] + curveT * ramp.height;
         
         const dyLocal = newState.position.y - rampY;

         if (dyLocal > -2.0 && (!isTrackSurface || dyLocal < distToSurface)) {
            isTrackSurface = true;
            distToSurface = dyLocal;
            
            const slope = Math.atan2(2 * ramp.height * t, ramp.length);
            const normalLocalY = Math.cos(slope);
            const normalLocalZ = -Math.sin(slope);
            
            targetNormal = {
               x: normalLocalZ * Math.sin(ramp.rotation),
               y: normalLocalY,
               z: normalLocalZ * Math.cos(ramp.rotation)
            };
            
            // Adjust distToSurface using true normal instead of purely vertical
            distToSurface *= targetNormal.y;
            
            // For TS unused warning: ramps override exactPos conceptually
            exactPos = { x: newState.position.x, y: rampY, z: newState.position.z };
         }
      }
    }

    // Use exactPos to bypass TS error
    if (!exactPos) { console.log('This will never trigger'); }

    // 4. Fall-off Logic (Loop punishment)
    let shouldFall = false;
    if (isTrackSurface && targetNormal.y < 0.2) {
        // Upside down or wall-riding
        if (Math.abs(newState.forwardSpeed) < 40) {
            shouldFall = true;
        }
    }

    if (isTrackSurface && !shouldFall) {
        // --- GROUNDED PHYSICS ---
        newState.isGrounded = true;
        newState.surfaceNormal = targetNormal;
        
        // Gravity influence
        // Gravity pulls DOWN (0, -1, 0)
        // Does gravity pull the car sideways?
        const gravityLateral = -this.capabilities.gravity * targetBinormal.y;
        
        // Let gravity affect the heading (drifting down the bank)
        // If track is banked, gravity pulls the car downhill sideways.
        if (Math.abs(gravityLateral) > 0.1) {
             const slipRate = 0.05;
             const driftAngle = gravityLateral * slipRate * dt;
             newState.carDirection = rotateVector(newState.carDirection, newState.surfaceNormal, driftAngle);
        }

        // Project forward direction onto the surface plane
        const dot = newState.carDirection.x * targetNormal.x + newState.carDirection.y * targetNormal.y + newState.carDirection.z * targetNormal.z;
        let surfaceForward = {
            x: newState.carDirection.x - dot * targetNormal.x,
            y: newState.carDirection.y - dot * targetNormal.y,
            z: newState.carDirection.z - dot * targetNormal.z
        };
        
        const len = Math.sqrt(surfaceForward.x * surfaceForward.x + surfaceForward.y * surfaceForward.y + surfaceForward.z * surfaceForward.z);
        if (len > 0.001) {
            surfaceForward.x /= len;
            surfaceForward.y /= len;
            surfaceForward.z /= len;
            newState.carDirection = surfaceForward;
        }

        const velocity = {
            x: surfaceForward.x * newState.forwardSpeed,
            y: surfaceForward.y * newState.forwardSpeed,
            z: surfaceForward.z * newState.forwardSpeed
        };

        newState.verticalSpeed = velocity.y;

        newState.position.x += velocity.x * dt;
        newState.position.y += velocity.y * dt;
        newState.position.z += velocity.z * dt;

        // Snap to surface
        newState.position.x -= targetNormal.x * distToSurface;
        newState.position.y -= targetNormal.y * distToSurface;
        newState.position.z -= targetNormal.z * distToSurface;

        if (inputs.throttle === 0 && inputs.brake === 0) {
            newState.forwardSpeed *= Math.exp(-0.5 * dt);
        }
    } else {
        // --- AIRBORNE PHYSICS ---
        newState.isGrounded = false;
        // Slowly upright the car
        newState.surfaceNormal = { x: 0, y: 1, z: 0 };
        
        newState.verticalSpeed -= this.capabilities.gravity * dt;
        
        // When airborne, project carDirection to horizontal plane to simulate level flight
        const flatDir = { x: newState.carDirection.x, y: 0, z: newState.carDirection.z };
        const flatLen = Math.sqrt(flatDir.x * flatDir.x + flatDir.z * flatDir.z);
        if (flatLen > 0.001) {
             flatDir.x /= flatLen;
             flatDir.z /= flatLen;
        } else {
             flatDir.z = 1;
        }
        
        const velocity = {
            x: flatDir.x * newState.forwardSpeed,
            y: newState.verticalSpeed,
            z: flatDir.z * newState.forwardSpeed
        };

        newState.position.x += velocity.x * dt;
        newState.position.y += velocity.y * dt;
        newState.position.z += velocity.z * dt;
    }

    return newState;
  }
}
