import type { CartesianCapabilities as CarCapabilities } from './CartesianPhysics';

export type SegmentType = 'straight' | 'curve' | 'jump';

export interface BaseSegment {
  id: string;
  type: SegmentType;
  slopeAngle: number; // radians, >0 is uphill
}

export interface StraightSegment extends BaseSegment {
  type: 'straight';
  length: number;
}

export interface CurveSegment extends BaseSegment {
  type: 'curve';
  length: number;
  radius: number;
}

export interface JumpSegment extends BaseSegment {
  type: 'jump';
  gapDistance: number; // Horizontal distance
  gapElevationChange: number; // Vertical change (Y_target - Y_launch)
}

export type ValidationSegment = StraightSegment | CurveSegment | JumpSegment;

export interface ValidationResult {
  isPossible: boolean;
  failureReason?: string;
  failureSegmentIndex?: number;
  maxSpeedProfile: number[]; // Max feasible speed at the end of each segment
}

export class TrackValidator {
  capabilities: CarCapabilities;

  constructor(capabilities: CarCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Mathematically proves if a given sequence of track segments is physically
   * traversable by a car with the given capabilities.
   */
  validate(segments: ValidationSegment[]): ValidationResult {
    const numSegments = segments.length;
    if (numSegments === 0) {
      return { isPossible: true, maxSpeedProfile: [] };
    }

    // Pass 1: Forward Pass 
    // Calculate the MAXIMUM mathematically possible entry and exit speeds 
    // assuming optimal acceleration at every point.
    const maxSpeedsForward = new Array(numSegments + 1).fill(0);
    maxSpeedsForward[0] = 0; // Starts from rest

    for (let i = 0; i < numSegments; i++) {
      const seg = segments[i];
      const entrySpeed = maxSpeedsForward[i];

      if (seg.type === 'straight' || seg.type === 'curve') {
        // Compute acceleration reduced by gravity on slopes
        const gravityComponent = this.capabilities.gravity * Math.sin(seg.slopeAngle);
        const maxNetAccel = this.capabilities.maxAcceleration - gravityComponent;

        if (maxNetAccel < 0 && entrySpeed <= 0) {
          return {
            isPossible: false,
            failureReason: 'Car stalled on uphill slope. Lacks acceleration to climb.',
            failureSegmentIndex: i,
            maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
          };
        }

        const vFinalSquared = entrySpeed * entrySpeed + 2 * maxNetAccel * seg.length;
        if (vFinalSquared < 0) {
          return {
            isPossible: false,
            failureReason: 'Car rolled backward on slope due to insufficient momentum and acceleration.',
            failureSegmentIndex: i,
            maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
          };
        }

        let exitSpeed = Math.min(this.capabilities.maxVelocity, Math.sqrt(vFinalSquared));
        
        // Curves have an absolute speed limit to avoid sliding out
        if (seg.type === 'curve') {
          if (seg.radius < 15) {
            return {
              isPossible: false,
              failureReason: `Curve radius ${seg.radius.toFixed(1)}m is physically too tight for the steering lock. Minimum is 15m.`,
              failureSegmentIndex: i,
              maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
            };
          }
          const maxSteerSpeed = seg.radius * (60 * this.capabilities.steeringSensitivity);
          const maxCornerSpeed = Math.min(
            Math.sqrt(this.capabilities.maxLateralG * seg.radius),
            maxSteerSpeed
          );
          exitSpeed = Math.min(exitSpeed, maxCornerSpeed);
        }

        maxSpeedsForward[i + 1] = exitSpeed;

      } else if (seg.type === 'jump') {
        const launchAngle = i > 0 ? segments[i - 1].slopeAngle : 0;
        const D = seg.gapDistance;
        const H = seg.gapElevationChange;
        const g = this.capabilities.gravity;

        // Kinematic Parabolic Trajectory check
        // Equation of motion solving for required initial velocity:
        // H = D * tan(theta) - (g * D^2) / (2 * v^2 * cos^2(theta))
        const cosTheta = Math.cos(launchAngle);
        if (cosTheta <= 0) {
          return {
            isPossible: false,
            failureReason: 'Launch angle is vertical or backward. Jump is impossible.',
            failureSegmentIndex: i,
            maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
          };
        }

        const threshold = D * Math.tan(launchAngle) - H;
        if (threshold <= 0) {
          return {
            isPossible: false,
            failureReason: 'Target is mathematically out of reach (requires infinite launch velocity).',
            failureSegmentIndex: i,
            maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
          };
        }

        const minRequiredSpeedSquared = (g * D * D) / (2 * threshold * cosTheta * cosTheta);
        const minRequiredSpeed = Math.sqrt(minRequiredSpeedSquared);

        if (entrySpeed < minRequiredSpeed) {
          return {
            isPossible: false,
            failureReason: `Insufficient speed for jump. Needs ${minRequiredSpeed.toFixed(2)} m/s, achieved max ${entrySpeed.toFixed(2)} m/s.`,
            failureSegmentIndex: i,
            maxSpeedProfile: maxSpeedsForward.slice(0, i + 1)
          };
        }

        // Speed on landing mapping to longitudinal velocity
        const t = D / (entrySpeed * cosTheta);
        const vx = entrySpeed * cosTheta;
        const vy = entrySpeed * Math.sin(launchAngle) - g * t;
        const landingSpeed = Math.sqrt(vx * vx + vy * vy);

        maxSpeedsForward[i + 1] = Math.min(this.capabilities.maxVelocity, landingSpeed);
      }
    }

    // Pass 2: Backward Pass 
    // Ensure we can brake in time for corners and limits
    const maxSpeedsBackward = new Array(numSegments + 1).fill(this.capabilities.maxVelocity);
    
    for (let i = numSegments - 1; i >= 0; i--) {
      const seg = segments[i];
      let limitAtExit = maxSpeedsBackward[i + 1];

      // Next segment restrictions
      if (i < numSegments - 1 && segments[i + 1].type === 'curve') {
        const nextSeg = segments[i + 1] as CurveSegment;
        const maxSteerSpeed = nextSeg.radius * (60 * this.capabilities.steeringSensitivity);
        const maxCornerSpeed = Math.min(
          Math.sqrt(this.capabilities.maxLateralG * nextSeg.radius),
          maxSteerSpeed
        );
        limitAtExit = Math.min(limitAtExit, maxCornerSpeed);
      }

      if (seg.type === 'straight' || seg.type === 'curve') {
        // Braking is aided by uphill slopes, hindered by downhill
        const gravityComponent = this.capabilities.gravity * Math.sin(seg.slopeAngle);
        const maxNetBraking = this.capabilities.maxBraking + gravityComponent; 
        
        if (maxNetBraking < 0) {
            // Downhill is steeper than the brakes can hold. Speed will inevitably increase.
            const accel = -maxNetBraking; 
            const entrySq = limitAtExit * limitAtExit - 2 * accel * seg.length;
            if (entrySq < 0) {
                return {
                    isPossible: false,
                    failureReason: 'Runaway downhill speed: brakes are insufficient to slow down for the next segment constraint.',
                    failureSegmentIndex: i,
                    maxSpeedProfile: []
                };
            }
            maxSpeedsBackward[i] = Math.sqrt(entrySq);
        } else {
            // Normal braking
            const entrySq = limitAtExit * limitAtExit + 2 * maxNetBraking * seg.length;
            maxSpeedsBackward[i] = Math.sqrt(entrySq);
        }
      } else if (seg.type === 'jump') {
         // Mid-air speed conservation
         const entrySq = limitAtExit * limitAtExit + 2 * this.capabilities.gravity * seg.gapElevationChange;
         maxSpeedsBackward[i] = entrySq < 0 ? 0 : Math.sqrt(entrySq);
      }

      maxSpeedsBackward[i] = Math.min(maxSpeedsBackward[i], this.capabilities.maxVelocity);
    }

    // Reconcile Passes
    const feasibleProfile = [];
    for (let i = 0; i <= numSegments; i++) {
        feasibleProfile.push(Math.min(maxSpeedsForward[i], maxSpeedsBackward[i]));
    }
    
    // Pass 3: Final validation check for jump speeds being compromised by braking
    for (let i = 0; i < numSegments; i++) {
        const seg = segments[i];
        if (seg.type === 'jump') {
            const entrySpeed = feasibleProfile[i];
            const launchAngle = i > 0 ? segments[i - 1].slopeAngle : 0;
            const D = seg.gapDistance;
            const H = seg.gapElevationChange;
            const g = this.capabilities.gravity;
            
            const cosTheta = Math.cos(launchAngle);
            const threshold = D * Math.tan(launchAngle) - H;
            if (threshold > 0 && cosTheta > 0) {
                const minRequiredSpeed = Math.sqrt((g * D * D) / (2 * threshold * cosTheta * cosTheta));
                if (entrySpeed < minRequiredSpeed) {
                    return {
                        isPossible: false,
                        failureReason: 'Required braking for a subsequent segment limits speed too much to clear this jump.',
                        failureSegmentIndex: i,
                        maxSpeedProfile: feasibleProfile
                    };
                }
            }
        }
    }

    return {
      isPossible: true,
      maxSpeedProfile: feasibleProfile
    };
  }
}
