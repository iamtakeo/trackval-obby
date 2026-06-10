import * as THREE from 'three';
import { GeneticAlgorithm } from '../generation/GeneticAlgorithm';
import { MathOracle } from '../generation/MathOracle';

export function generateTrackCurve(): THREE.CatmullRomCurve3 {
  // 1. Run the Genetic Algorithm to evolve a Track DNA
  const ga = new GeneticAlgorithm({
    populationSize: 50,
    generations: 20,
    segmentsPerTrack: 15
  });
  
  const bestDna = ga.run();

  // 2. Use the Math Oracle to convert DNA into physical 3D SplinePoints
  const splinePoints = MathOracle.generateSpline(bestDna, 5);

  // MathOracle uses Z for elevation and X/Y for the 2D layout.
  // Three.js uses Y for elevation and X/Z for the 2D plane.
  const vectors = splinePoints.map(sp => new THREE.Vector3(
    sp.position[0],  // X -> X
    sp.position[2],  // Z (elevation) -> Y
    -sp.position[1]  // Y (2D layout) -> -Z
  ));

  // Ensure it loops back roughly
  vectors.push(vectors[0].clone());

  // 4. Create the curve
  const curve = new THREE.CatmullRomCurve3(vectors, true, 'centripetal', 0.5);
  return curve;
}
