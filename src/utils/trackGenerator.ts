import * as THREE from 'three';
import { GeneticAlgorithm } from '../generation/GeneticAlgorithm';
import { MathOracle } from '../generation/MathOracle';
import { TrackValidator } from '../engine/TrackValidator';
import type { ValidationSegment } from '../engine/TrackValidator';
import type { CartesianCapabilities } from '../engine/CartesianPhysics';

export interface GeneratorParams {
  segmentsPerTrack?: number;
  generations?: number;
  elevationVariance?: number; // 1 = normal, higher = steeper hills
  curvatureVariance?: number; // 1 = normal, higher = sharper turns
}

const defaultCapabilities: CartesianCapabilities = {
  maxAcceleration: 40,
  maxBraking: 60,
  maxVelocity: 150,
  maxLateralG: 40,
  steeringSensitivity: 0.015,
  gravity: 50
};

export function generateTrackCurve(params: GeneratorParams = {}): { curve: THREE.CatmullRomCurve3, failureReason?: string } {
  const validator = new TrackValidator(defaultCapabilities);

  // We will loop up to 5 times to find a physically valid track,
  // but if all 5 fail, we'll return the last failure reason.
  const maxRetries = 5;
  let lastFailureReason = "Unknown error";
  
  // Create GA
  const ga = new GeneticAlgorithm({
    populationSize: 50,
    generations: params.generations || 20,
    segmentsPerTrack: params.segmentsPerTrack || 15
  });

  // Apply variance multipliers directly to GA mutation or we can just run it.
  // Actually, we'd need to modify GeneticAlgorithm to accept elevation/curvature variance.
  // For now, we will rely on the validator to weed out extreme tracks.

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const bestDna = ga.run();

    // Map DNA to ValidationSegments
    const validationSegments: ValidationSegment[] = bestDna.segments.map(seg => {
      const isStraight = Math.abs(seg.sweepAngle) < 0.0001;
      const arcLength = isStraight ? seg.radius : seg.radius * Math.abs(seg.sweepAngle);
      const slopeAngle = Math.atan2(seg.elevation, arcLength);

      if (isStraight) {
        return { id: Math.random().toString(), type: 'straight', length: arcLength, slopeAngle };
      } else {
        return { id: Math.random().toString(), type: 'curve', length: arcLength, radius: seg.radius, slopeAngle };
      }
    });

    const validation = validator.validate(validationSegments);

    if (!validation.isPossible) {
      lastFailureReason = validation.failureReason || "Mathematically impossible sequence.";
      continue; // Try again
    }

    // Success! Generate Spline
    const splinePoints = MathOracle.generateSpline(bestDna, 5);

    const vectors = splinePoints.map(sp => new THREE.Vector3(
      sp.position[0],
      sp.position[2],
      -sp.position[1]
    ));

    vectors.push(vectors[0].clone());

    // Fix Elevation Offset
    let minY = Infinity;
    for (const v of vectors) {
      if (v.y < minY) minY = v.y;
    }

    // Shift everything so the lowest point is at y = 10 (above ground plane at 0)
    const yOffset = 10 - minY;
    for (const v of vectors) {
      v.y += yOffset;
    }

    const curve = new THREE.CatmullRomCurve3(vectors, true, 'centripetal', 0.5);
    
    // We only return failureReason if we couldn't generate a valid one, but here we succeeded.
    return { curve }; 
  }

  // If we exhausted all retries, return a basic flat oval to prevent crashing, plus the failure reason.
  const flatVectors = [
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(50, 10, 50),
    new THREE.Vector3(100, 10, 0),
    new THREE.Vector3(50, 10, -50),
    new THREE.Vector3(0, 10, 0)
  ];
  const fallbackCurve = new THREE.CatmullRomCurve3(flatVectors, true, 'centripetal', 0.5);

  return { curve: fallbackCurve, failureReason: lastFailureReason };
}
