

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
    const resolution = Math.max(100, Math.floor(totalLength / 2)); // Sample every ~2 units
    
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
    let closestSample = this.trackSamples[0];

    // Find the closest point in 3D space to prevent falling through bridges!
    for (const sample of this.trackSamples) {
      const dx = sample.pos.x - x;
      const dy = sample.pos.y - y;
      const dz = sample.pos.z - z;
      
      // We weight Y distance less heavily so we don't snap to an adjacent track if we jump high
      // But we still need Y to differentiate overpass vs underpass.
      const distSq = dx * dx + (dy * dy * 0.1) + dz * dz; 
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestSample = sample;
      }
    }

    // Recalculate true 2D distance for the track bounds check
    const dx2d = closestSample.pos.x - x;
    const dz2d = closestSample.pos.z - z;
    const dist2d = Math.sqrt(dx2d * dx2d + dz2d * dz2d);

    // If we are within the track width, compute the exact surface Y using the binormal
    if (dist2d <= this.trackWidth / 2 + 1.0) { // 1.0 margin of error
      // The track's physical UP vector is now exactly the normal
      const surfaceUp = { x: closestSample.normal.x, y: closestSample.normal.y, z: closestSample.normal.z };
      
      // Calculate how far laterally we are from the center
      // binormal is horizontal across the track
      const dx = x - closestSample.pos.x;
      const dz = z - closestSample.pos.z;
      const lateralDot = dx * closestSample.binormal.x + dz * closestSample.binormal.z;
      
      // The exact surface height accounts for banking
      const exactY = closestSample.pos.y + lateralDot * closestSample.binormal.y;

      return {
        onTrack: true,
        surfaceY: exactY,
        normal: surfaceUp // We return the surface UP vector
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
      accel -= Math.sign(newState.forwardSpeed) * this.capabilities.maxBraking * 0.8;
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
       currentSensitivity *= 2.5; 
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
