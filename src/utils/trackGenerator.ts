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

  // 3. Map the generated points to THREE.Vector3 for the CatmullRomCurve3
  const vectors = splinePoints.map(sp => new THREE.Vector3(sp.position[0], sp.position[1], sp.position[2]));

  // Ensure it loops back roughly
  vectors.push(vectors[0].clone());

  // 4. Create the curve
  const curve = new THREE.CatmullRomCurve3(vectors, true, 'centripetal', 0.5);
  return curve;
}
