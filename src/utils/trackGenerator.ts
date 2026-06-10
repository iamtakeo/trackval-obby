import * as THREE from 'three';
import { GeneticAlgorithm } from '../generation/GeneticAlgorithm';
import { MathOracle } from '../generation/MathOracle';
import { TrackValidator } from '../engine/TrackValidator';
import type { ValidationSegment } from '../engine/TrackValidator';
import type { CartesianCapabilities } from '../engine/CartesianPhysics';

export interface TrackData {
  curve: THREE.CatmullRomCurve3;
  frames: {
    tangents: THREE.Vector3[];
    normals: THREE.Vector3[];
    binormals: THREE.Vector3[];
  };
  failureReason?: string;
}

export function computeFixedUpFrames(curve: THREE.CatmullRomCurve3, segments: number) {
  const tangents = [];
  const normals = [];
  const binormals = [];

  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const tangent = curve.getTangentAt(u).normalize();
    tangents.push(tangent);

    // binormal is horizontal (perpendicular to tangent and global UP)
    const binormal = new THREE.Vector3().crossVectors(tangent, up);
    
    if (binormal.lengthSq() < 0.0001) {
      binormal.copy(binormals[i - 1] || new THREE.Vector3(1, 0, 0));
    } else {
      binormal.normalize();
    }
    
    binormals.push(binormal);

    // normal is perpendicular to binormal and tangent (this will be our UP vector)
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
    normals.push(normal);
  }

  return { tangents, normals, binormals };
}

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

export function generateTrackCurve(params: GeneratorParams = {}): TrackData {
  const validator = new TrackValidator(defaultCapabilities);

  const maxRetries = 5;
  let lastFailureReason = "Unknown error";
  
  const ga = new GeneticAlgorithm({
    populationSize: 50,
    generations: params.generations || 20,
    segmentsPerTrack: params.segmentsPerTrack || 15
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const bestDna = ga.run();

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
      continue;
    }

    const splinePoints = MathOracle.generateSpline(bestDna, 5);

    const vectors = splinePoints.map(sp => new THREE.Vector3(
      sp.position[0],
      sp.position[2],
      -sp.position[1]
    ));

    vectors.push(vectors[0].clone());

    let minY = Infinity;
    for (const v of vectors) {
      if (v.y < minY) minY = v.y;
    }

    const yOffset = 10 - minY;
    for (const v of vectors) {
      v.y += yOffset;
    }

    const curve = new THREE.CatmullRomCurve3(vectors, true, 'centripetal', 0.5);
    const frames = computeFixedUpFrames(curve, 400);
    
    return { curve, frames }; 
  }

  const flatVectors = [
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(50, 10, 50),
    new THREE.Vector3(100, 10, 0),
    new THREE.Vector3(50, 10, -50),
    new THREE.Vector3(0, 10, 0)
  ];
  const fallbackCurve = new THREE.CatmullRomCurve3(flatVectors, true, 'centripetal', 0.5);
  const frames = computeFixedUpFrames(fallbackCurve, 400);

  return { curve: fallbackCurve, frames, failureReason: lastFailureReason };
}
