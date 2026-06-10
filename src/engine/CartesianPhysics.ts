

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
}

export interface CartesianCapabilities {
  maxAcceleration: number; // m/s^2
  maxBraking: number;      // m/s^2
  maxVelocity: number;     // m/s
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

  private getClosestTrackSurface(x: number, z: number): { onTrack: boolean, surfaceY: number, normal: Vector3 } {
    let minDistSq = Infinity;
    let closestSample = this.trackSamples[0];

    // Find the closest point on the track center curve (ignoring Y to find overhead projection)
    for (const sample of this.trackSamples) {
      const dx = sample.pos.x - x;
      const dz = sample.pos.z - z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestSample = sample;
      }
    }

    const dist = Math.sqrt(minDistSq);

    // If we are within the track width, compute the exact surface Y using the binormal
    if (dist <= this.trackWidth / 2 + 1.0) { // 1.0 margin of error
      // The track's physical UP vector is the inverse of the normal
      const surfaceUp = { x: -closestSample.normal.x, y: -closestSample.normal.y, z: -closestSample.normal.z };
      
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

    return { onTrack: false, surfaceY: -100, normal: { x: 0, y: 1, z: 0 } };
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

    // Apply drag based on velocity square
    const speedRatio = Math.abs(newState.forwardSpeed) / this.capabilities.maxVelocity;
    const drag = Math.sign(newState.forwardSpeed) * this.capabilities.maxAcceleration * (speedRatio * speedRatio);
    accel -= drag;

    newState.forwardSpeed += accel * dt;
    
    // Hard cap max velocity
    newState.forwardSpeed = Math.max(-this.capabilities.maxVelocity * 0.2, Math.min(newState.forwardSpeed, this.capabilities.maxVelocity));

    // 2. Steering
    // The car can only turn if it is moving.
    const turnRadiusEffect = newState.forwardSpeed * this.capabilities.steeringSensitivity;
    // inputs.steering is -1 (Left) to 1 (Right).
    // In our 3D world, right turn means decreasing yaw angle (negative rotation around Y)
    newState.heading -= inputs.steering * turnRadiusEffect * dt;

    // 3. X/Z Movement
    // Heading 0 means pointing along positive Z? 
    // In Three.js, Math.sin(heading) and Math.cos(heading) define direction.
    // Let's standardise: Z is forward.
    const vx = Math.sin(newState.heading) * newState.forwardSpeed;
    const vz = Math.cos(newState.heading) * newState.forwardSpeed;

    newState.position.x += vx * dt;
    newState.position.z += vz * dt;

    // 4. Track Collision & Gravity
    const surfaceInfo = this.getClosestTrackSurface(newState.position.x, newState.position.z);
    
    // We also check the ground plane at y = -100
    let targetSurfaceY = -100;
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
