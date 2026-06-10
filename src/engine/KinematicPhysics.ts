export type Vector3 = { x: number; y: number; z: number };

export interface GroundedState {
  type: 'grounded';
  s: number; // Longitudinal distance along the track (Frenet coordinate)
  u: number; // Lateral distance from the track center (Frenet coordinate)
  sDot: number; // Longitudinal velocity
  uDot: number; // Lateral velocity
}

export interface AirborneState {
  type: 'airborne';
  position: Vector3; // Cartesian X, Y, Z
  velocity: Vector3; // Cartesian Vx, Vy, Vz
}

export type PhysicsState = GroundedState | AirborneState;

export interface CarInputs {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steering: number; // -1 (left) to 1 (right)
}

export interface CarCapabilities {
  maxAcceleration: number; // m/s^2
  maxBraking: number;      // m/s^2
  maxVelocity: number;     // m/s
  maxLateralG: number;     // m/s^2
  mass: number;            // kg
  gravity: number;         // m/s^2 (typically 9.81)
}

/**
 * Interface that the Track must implement to convert between 
 * Frenet Space (s, u) and Cartesian Space (x, y, z).
 */
export interface TrackGeometry {
  getTotalLength(): number;
  getWidth(s: number): number;
  getCartesian(s: number, u: number): Vector3;
  getTangent(s: number): Vector3;
  getNormal(s: number): Vector3;
  getBinormal(s: number): Vector3;
  
  /**
   * Projects a cartesian point back onto the track to check for landing.
   * Returns onTrack = true if the point lies on the track surface.
   */
  projectToTrack(pos: Vector3): { onTrack: boolean; s: number; u: number };
}

export class KinematicPhysics {
  capabilities: CarCapabilities;
  track: TrackGeometry;

  constructor(capabilities: CarCapabilities, track: TrackGeometry) {
    this.capabilities = capabilities;
    this.track = track;
  }

  /**
   * Advances the physics simulation by delta time (dt).
   * It deterministically resolves the state between Frenet and Cartesian coordinates.
   */
  step(dt: number, state: PhysicsState, inputs: CarInputs): PhysicsState {
    if (state.type === 'grounded') {
      return this.stepGrounded(dt, state, inputs);
    } else {
      return this.stepAirborne(dt, state);
    }
  }

  private stepGrounded(dt: number, state: GroundedState, inputs: CarInputs): PhysicsState {
    // 1. Determine Longitudinal Acceleration
    let accel = 0;
    if (inputs.throttle > 0) {
      accel = inputs.throttle * this.capabilities.maxAcceleration;
    } else if (inputs.brake > 0) {
      accel = -inputs.brake * this.capabilities.maxBraking;
    }
    
    // Simple drag formulation to naturally cap at maxVelocity
    // Drag = a_max * (v / v_max)^2
    const speedRatio = state.sDot / this.capabilities.maxVelocity;
    const drag = this.capabilities.maxAcceleration * (speedRatio * speedRatio);
    accel -= drag;

    let newSDot = state.sDot + accel * dt;
    // Disallow moving backwards for this simple obby engine
    newSDot = Math.max(0, Math.min(newSDot, this.capabilities.maxVelocity));

    // 2. Determine Lateral Acceleration (Steering)
    // Steering maps to a target lateral velocity, capped by maxLateralG
    // Steering inputs are [-1, 1]. The car tries to reach a lateral velocity.
    const targetUDot = inputs.steering * this.capabilities.maxVelocity * 0.2; // 20% of max speed laterally
    const lateralAccelReq = (targetUDot - state.uDot) / dt;
    
    const maxLatAccel = this.capabilities.maxLateralG;
    const clampedLatAccel = Math.max(-maxLatAccel, Math.min(maxLatAccel, lateralAccelReq));
    
    const newUDot = state.uDot + clampedLatAccel * dt;

    // 3. Update Positions in Frenet Space
    const newS = state.s + newSDot * dt;
    const newU = state.u + newUDot * dt;

    // 4. Track Bounds / Airborne Transition Check
    const trackWidth = this.track.getWidth(newS);
    if (Math.abs(newU) > trackWidth / 2 || newS > this.track.getTotalLength()) {
      // Car has driven off the track horizontally or passed the end of the track.
      // We convert its current state back to Cartesian to launch it into the air.
      
      const pos = this.track.getCartesian(state.s, state.u); // Launch from last known valid point
      const tangent = this.track.getTangent(state.s);
      const binormal = this.track.getBinormal(state.s);
      
      // V = V_long * tangent + V_lat * binormal
      const velocity: Vector3 = {
        x: tangent.x * state.sDot + binormal.x * state.uDot,
        y: tangent.y * state.sDot + binormal.y * state.uDot,
        z: tangent.z * state.sDot + binormal.z * state.uDot,
      };

      return {
        type: 'airborne',
        position: pos,
        velocity: velocity
      };
    }

    return {
      type: 'grounded',
      s: newS,
      u: newU,
      sDot: newSDot,
      uDot: newUDot
    };
  }

  private stepAirborne(dt: number, state: AirborneState): PhysicsState {
    const g = this.capabilities.gravity;

    // Apply parabolic gravity to velocity
    const newVelocity = {
      x: state.velocity.x,
      y: state.velocity.y - g * dt,
      z: state.velocity.z
    };

    // Integrate position
    const newPosition = {
      x: state.position.x + newVelocity.x * dt,
      y: state.position.y + newVelocity.y * dt,
      z: state.position.z + newVelocity.z * dt
    };

    // Check for landing back onto the track
    const projection = this.track.projectToTrack(newPosition);
    if (projection.onTrack) {
      // The car has successfully intersected the track geometry.
      // Convert Cartesian velocity back to Frenet space velocity.
      const tangent = this.track.getTangent(projection.s);
      const binormal = this.track.getBinormal(projection.s);

      // Dot product of velocity with tangent and binormal
      const sDot = newVelocity.x * tangent.x + newVelocity.y * tangent.y + newVelocity.z * tangent.z;
      const uDot = newVelocity.x * binormal.x + newVelocity.y * binormal.y + newVelocity.z * binormal.z;

      // Upon landing, we could penalize speed or handle crash thresholds here
      return {
        type: 'grounded',
        s: projection.s,
        u: projection.u,
        sDot: Math.max(0, sDot), // Lose backward momentum on landing
        uDot: uDot
      };
    }

    return {
      type: 'airborne',
      position: newPosition,
      velocity: newVelocity
    };
  }
}
