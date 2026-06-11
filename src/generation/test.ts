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

console.log("Generating Segments...");
const segments = MathOracle.generateMathematicalSegments(bestTrack, 5);
console.log(`Generated ${segments.length} segments.`);
console.log("First segment:", segments[0]);
console.log("Last segment:", segments[segments.length - 1]);
