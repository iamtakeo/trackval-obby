import { GeneticAlgorithm } from './GeneticAlgorithm';
import { MathOracle } from './MathOracle';

const ga = new GeneticAlgorithm({
    populationSize: 20,
    generations: 50,
    segmentsPerTrack: 10
});

console.log("Running GA...");
const bestTrack = ga.run();
console.log("Best Track DNA:", JSON.stringify(bestTrack, null, 2));

console.log("Generating Spline points...");
const spline = MathOracle.generateSpline(bestTrack, 5);
console.log(`Generated ${spline.length} points.`);
console.log("First point:", spline[0]);
console.log("Last point:", spline[spline.length - 1]);
