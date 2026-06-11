import * as THREE from 'three';
import { GeneticAlgorithm } from '../generation/GeneticAlgorithm';
import { MathOracle } from '../generation/MathOracle';
import type { MathematicalSegment } from '../generation/MathOracle';
import { LoopCurve3 } from '../generation/LoopCurve3';
import { TrackValidator } from '../engine/TrackValidator';
import type { ValidationSegment } from '../engine/TrackValidator';
import type { CartesianCapabilities } from '../engine/CartesianPhysics';
import type { TrackDNA } from '../generation/types';

export interface TrackData {
  curve: THREE.Curve<THREE.Vector3>;
  frames: {
    tangents: THREE.Vector3[];
    normals: THREE.Vector3[];
    binormals: THREE.Vector3[];
    widths: number[];
  };
  failureReason?: string;
  dna?: TrackDNA;
}

export interface GeneratorParams {
  segmentsPerTrack?: number;
  generations?: number;
  elevationVariance?: number;
  curvatureVariance?: number;
  isClosed?: boolean;
  dna?: TrackDNA;
  loopChance?: number;
  turnChance?: number;
  elevationVolatility?: number;
  sequenceVariety?: number;
  widthVolatility?: number;
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

  if (params.dna) {
    const segments = MathOracle.generateMathematicalSegments(params.dna, 5);
    return buildTrackCurve(segments, params.dna);
  }

  const maxRetries = 5;
  let lastFailureReason = "Unknown error";
  
  const ga = new GeneticAlgorithm({
    populationSize: 50,
    generations: params.generations || 20,
    segmentsPerTrack: params.segmentsPerTrack || 15,
    loopChance: params.loopChance,
    turnChance: params.turnChance,
    elevationVolatility: params.elevationVolatility,
    sequenceVariety: params.sequenceVariety,
    isClosed: params.isClosed
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

    const segments = MathOracle.generateMathematicalSegments(bestDna, 5);
    return buildTrackCurve(segments, bestDna);
  }

  // Fallback
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 10, -100)));
  const frames = computeFixedUpFrames(path, 400, []);

  return { curve: path, frames, failureReason: lastFailureReason };
}

function buildTrackCurve(segments: MathematicalSegment[], dna?: TrackDNA): TrackData {
    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    
    let minY = Infinity;
    const worldSegments: any[] = [];
    
    // Transform MathOracle coords to World coords
    for (const seg of segments) {
        if (seg.type === 'catmull') {
            const vecs = seg.points.map(sp => {
                const v = new THREE.Vector3(sp.position[0], sp.position[2], -sp.position[1]);
                if (v.y < minY) minY = v.y;
                return v;
            });
            worldSegments.push({ type: 'catmull', vectors: vecs, points: seg.points });
        } else {
            const v = new THREE.Vector3(seg.startPoint.position[0], seg.startPoint.position[2], -seg.startPoint.position[1]);
            if (v.y < minY) minY = v.y; 
            worldSegments.push({ type: 'loop', startVec: v, radius: seg.radius, drift: seg.drift, endBank: seg.endBank, width: seg.startPoint.width });
        }
    }
    
    const yOffset = 10 - minY;

    // Build CurvePath
    for (let i = 0; i < worldSegments.length; i++) {
        const seg = worldSegments[i];
        
        if (seg.type === 'catmull') {
            for (const v of seg.vectors) v.y += yOffset;
            
            // If preceded by a loop, anchor the start perfectly to the loop's exit
            if (i > 0 && worldSegments[i-1].type === 'loop') {
                const prevCurve = curvePath.curves[curvePath.curves.length - 1];
                seg.vectors[0].copy(prevCurve.getPoint(1));
            }
            
            if (seg.vectors.length >= 2) {
                curvePath.add(new THREE.CatmullRomCurve3(seg.vectors, false, 'centripetal', 0.5));
            }
        } else {
            const startVec = seg.startVec;
            startVec.y += yOffset;
            
            let tangent = new THREE.Vector3(0, 0, -1);
            if (curvePath.curves.length > 0) {
                 const prevCurve = curvePath.curves[curvePath.curves.length - 1];
                 startVec.copy(prevCurve.getPoint(1)); // Anchor to previous curve
                 tangent = prevCurve.getTangent(1).normalize();
            }
            
            const loopCurve = new LoopCurve3(startVec, tangent, seg.radius, seg.drift);
            curvePath.add(loopCurve);
        }
    }

    if (dna && dna.isClosed && curvePath.curves.length > 0) {
        const firstCurve = curvePath.curves[0];
        const lastCurve = curvePath.curves[curvePath.curves.length - 1];
        
        const startPt = lastCurve.getPoint(1);
        const endPt = firstCurve.getPoint(0);
        
        const startTangent = lastCurve.getTangent(1).normalize();
        const endTangent = firstCurve.getTangent(0).normalize();
        
        const distance = startPt.distanceTo(endPt);
        const cp1 = startPt.clone().add(startTangent.clone().multiplyScalar(distance * 0.33));
        const cp2 = endPt.clone().sub(endTangent.clone().multiplyScalar(distance * 0.33));
        
        const closingCurve = new THREE.CubicBezierCurve3(startPt, cp1, cp2, endPt);
        curvePath.add(closingCurve);
        
        const lastSeg = worldSegments[worldSegments.length - 1];
        const firstSeg = worldSegments[0];
        const startWidth = lastSeg.type === 'catmull' ? lastSeg.points[lastSeg.points.length - 1].width : (lastSeg.width || 12);
        const endWidth = firstSeg.type === 'catmull' ? firstSeg.points[0].width : (firstSeg.width || 12);
        
        worldSegments.push({
            type: 'catmull',
            points: [
                { width: startWidth },
                { width: endWidth }
            ]
        });
    }

    const frames = computeFixedUpFrames(curvePath, 400, worldSegments);
    return { curve: curvePath, frames, dna }; 
}

export function computeFixedUpFrames(curvePath: THREE.CurvePath<THREE.Vector3>, steps: number, worldSegments: any[]) {
  const frames = curvePath.computeFrenetFrames(steps, false);
  
  const tangents = frames.tangents;
  const normals = frames.normals;
  const binormals = frames.binormals;
  const widths: number[] = [];

  let loopBinormal = new THREE.Vector3(1, 0, 0);
  const curveLengths = curvePath.getCurveLengths();
  const totalLength = curveLengths[curveLengths.length - 1] || 1;

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const tangent = tangents[i];
    const targetDistance = u * totalLength;
    
    let curveIndex = 0;
    while (curveIndex < curveLengths.length - 1 && curveLengths[curveIndex] < targetDistance) {
        curveIndex++;
    }
    
    const activeCurve = curvePath.curves[curveIndex];
    const isLoop = activeCurve instanceof LoopCurve3;
    const worldSeg = worldSegments[curveIndex];

    let width = 12;
    if (worldSeg) {
        if (worldSeg.type === 'loop') {
            width = worldSeg.width || 12;
        } else if (worldSeg.type === 'catmull' && worldSeg.points) {
            // Find local t within this curve
            const curveStartLen = curveIndex > 0 ? curveLengths[curveIndex - 1] : 0;
            const curveLen = curveLengths[curveIndex] - curveStartLen;
            const localT = curveLen > 0 ? (targetDistance - curveStartLen) / curveLen : 0;
            
            const numPoints = worldSeg.points.length;
            const floatIndex = localT * (numPoints - 1);
            const pIdx = Math.min(Math.floor(floatIndex), numPoints - 2);
            const frac = floatIndex - pIdx;
            
            if (pIdx >= 0 && pIdx < numPoints - 1) {
                const w1 = worldSeg.points[pIdx].width;
                const w2 = worldSeg.points[pIdx + 1].width;
                width = w1 + (w2 - w1) * frac;
            } else if (numPoints > 0) {
                width = worldSeg.points[0].width;
            }
        }
    }
    widths.push(width);

    if (!isLoop) {
        const globalUp = new THREE.Vector3(0, 1, 0);
        if (Math.abs(tangent.y) < 0.99) {
            binormals[i].crossVectors(tangent, globalUp).normalize();
            normals[i].crossVectors(binormals[i], tangent).normalize();
        }
        loopBinormal.copy(binormals[i]);
    } else {
        normals[i].crossVectors(loopBinormal, tangent).normalize();
        binormals[i].crossVectors(tangent, normals[i]).normalize();
    }
    
    // We omit banking logic for now to keep things mathematically pure, 
    // loops don't need banking, and curves can function on normal up vectors.
  }

  return { tangents, normals, binormals, widths };
}
