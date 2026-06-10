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
  dna?: TrackDNA;
}

export function computeFixedUpFrames(curve: THREE.CatmullRomCurve3, segments: number, splinePoints?: any[]) {
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
    
    // normal is perpendicular to binormal and tangent (this will be our UP vector)
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    // Apply track banking if splinePoints are provided
    if (splinePoints && splinePoints.length > 0) {
      const floatIndex = u * (splinePoints.length - 1);
      const idx = Math.floor(floatIndex);
      const frac = floatIndex - idx;
      const bank1 = splinePoints[idx].bank || 0;
      const bank2 = splinePoints[Math.min(idx + 1, splinePoints.length - 1)].bank || 0;
      const bankAngle = bank1 + (bank2 - bank1) * frac;

      if (Math.abs(bankAngle) > 0.001) {
        // Rotate the normal and binormal around the tangent axis by the bank angle
        const bankQuat = new THREE.Quaternion().setFromAxisAngle(tangent, bankAngle);
        normal.applyQuaternion(bankQuat);
        binormal.applyQuaternion(bankQuat);
      }
    }

    binormals.push(binormal);
    normals.push(normal);
  }

  return { tangents, normals, binormals };
}

import type { TrackDNA } from '../generation/types';

export interface GeneratorParams {
  segmentsPerTrack?: number;
  generations?: number;
  elevationVariance?: number; // 1 = normal, higher = steeper hills
  curvatureVariance?: number; // 1 = normal, higher = sharper turns
  isClosed?: boolean;
  dna?: TrackDNA;
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

  // If DNA is provided from the network, skip generation entirely!
  if (params.dna) {
    const splinePoints = MathOracle.generateSpline(params.dna, 5);
    return processSplinePoints(splinePoints, params);
  }

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
    return processSplinePoints(splinePoints, params, bestDna);
  }

  // Fallback
  const flatVectors = [
    new THREE.Vector3(0, 10, 0),
    new THREE.Vector3(50, 10, 50),
    new THREE.Vector3(100, 10, 0),
    new THREE.Vector3(50, 10, -50),
    new THREE.Vector3(0, 10, -100)
  ];
  const fallbackCurve = new THREE.CatmullRomCurve3(flatVectors, false, 'centripetal', 0.5);
  const frames = computeFixedUpFrames(fallbackCurve, 400);

  return { curve: fallbackCurve, frames, failureReason: lastFailureReason };
}

function processSplinePoints(splinePoints: any[], params: GeneratorParams, dna?: TrackDNA): TrackData & { dna?: TrackDNA } {
    let vectors = splinePoints.map(sp => new THREE.Vector3(
      sp.position[0],
      sp.position[2],
      -sp.position[1]
    ));

    if (params.isClosed) {
      const numPoints = vectors.length;
      if (numPoints > 20) {
        // 1. Warp the track so the ends meet
        const firstPoint = vectors[0];
        const lastPoint = vectors[numPoints - 1];
        const offset = new THREE.Vector3().subVectors(firstPoint, lastPoint);
        for (let i = 0; i < numPoints; i++) {
          const factor = i / (numPoints - 1);
          vectors[i].add(offset.clone().multiplyScalar(factor));
        }
        vectors[numPoints - 1].copy(vectors[0]);

        // 2. Smooth out the kink at the seam by replacing the last section
        // with a cubic bezier curve that blends gracefully into the starting tangent.
        const smoothingPoints = Math.min(20, Math.floor(numPoints / 4));
        const p0Index = numPoints - 1 - smoothingPoints;
        const p0 = vectors[p0Index];
        const p0Tangent = new THREE.Vector3().subVectors(vectors[p0Index], vectors[p0Index - 1]).normalize();
        
        const p3 = vectors[0];
        const p3Tangent = new THREE.Vector3().subVectors(vectors[1], vectors[0]).normalize();
        
        const dist = p0.distanceTo(p3);
        const p1 = p0.clone().add(p0Tangent.multiplyScalar(dist * 0.4));
        const p2 = p3.clone().sub(p3Tangent.multiplyScalar(dist * 0.4));
        
        const bezier = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        const smoothSegment = bezier.getPoints(smoothingPoints);
        
        for (let i = 0; i <= smoothingPoints; i++) {
           vectors[p0Index + i].copy(smoothSegment[i]);
        }
      }
    }

    let minY = Infinity;
    for (const v of vectors) {
      if (v.y < minY) minY = v.y;
    }

    const yOffset = 10 - minY;
    for (const v of vectors) {
      v.y += yOffset;
    }

    const curve = new THREE.CatmullRomCurve3(vectors, params.isClosed || false, 'centripetal', 0.5);
    const frames = computeFixedUpFrames(curve, 400, splinePoints);
    
    return { curve, frames, dna: dna || params.dna }; 
  }
