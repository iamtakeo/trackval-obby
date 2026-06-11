import type { TrackDNA, TrackSegmentDNA } from './types';
import { FitnessFunction } from './FitnessFunction';

export interface GAConfig {
    populationSize: number;
    mutationRate: number;
    generations: number;
    segmentsPerTrack: number;
    loopChance: number;
    turnChance: number;
    elevationVolatility: number;
}

export class GeneticAlgorithm {
    private config: GAConfig;
    private population: TrackDNA[] = [];

    constructor(config: Partial<GAConfig> = {}) {
        this.config = {
            populationSize: config.populationSize || 50,
            mutationRate: config.mutationRate || 0.1,
            generations: config.generations || 100,
            segmentsPerTrack: config.segmentsPerTrack || 20,
            loopChance: config.loopChance ?? 0.05,
            turnChance: config.turnChance ?? 0.8,
            elevationVolatility: config.elevationVolatility ?? 10
        };
    }

    private randomSegment(): TrackSegmentDNA {
        const isStraight = Math.random() > this.config.turnChance;
        return {
            // straight lines have sweep 0 and radius acts as length
            radius: isStraight ? Math.random() * 50 + 20 : Math.random() * 150 + 10,
            sweepAngle: isStraight ? 0 : (Math.random() - 0.5) * Math.PI, // -90 to 90 degrees
            bankAngle: (Math.random() - 0.5) * (Math.PI / 4), // -22.5 to 22.5 degrees
            width: Math.random() * 10 + 5, // 5 to 15m
            elevation: (Math.random() - 0.5) * this.config.elevationVolatility // elevation delta based on volatility
        };
    }

    private createInitialPopulation() {
        this.population = [];
        for (let i = 0; i < this.config.populationSize; i++) {
            const segments: TrackSegmentDNA[] = [];
            for (let j = 0; j < this.config.segmentsPerTrack; j++) {
                segments.push(this.randomSegment());
            }
            this.population.push({ segments });
        }
    }

    private crossover(parentA: TrackDNA, parentB: TrackDNA): TrackDNA {
        const childSegments: TrackSegmentDNA[] = [];
        for (let i = 0; i < this.config.segmentsPerTrack; i++) {
            // Uniform crossover
            childSegments.push(Math.random() < 0.5 
                ? { ...parentA.segments[i] } 
                : { ...parentB.segments[i] });
        }
        return { segments: childSegments };
    }

    private mutate(dna: TrackDNA) {
        dna.segments = dna.segments.map(seg => {
            if (Math.random() < this.config.mutationRate) {
                const isLoop = Math.random() < this.config.loopChance; // chance to become a loop
                if (isLoop) {
                    return {
                        type: 'loop',
                        radius: 15 + Math.random() * 20, // Loops need to be large enough
                        sweepAngle: 2 * Math.PI,
                        bankAngle: 0,
                        width: seg.width,
                        elevation: 0
                    };
                }
                
                const newSweep = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (seg.sweepAngle || 0) + (Math.random() - 0.5) * Math.PI / 4));
                return {
                    ...seg,
                    type: 'normal',
                    radius: Math.max((seg.width || 10) / 2 + 5, Math.max(10, (seg.radius || 0) + (Math.random() - 0.5) * 50)),
                    sweepAngle: Math.abs(newSweep) < 0.0001 ? 0 : newSweep,
                    bankAngle: (seg.bankAngle || 0) + (Math.random() - 0.5) * 0.2,
                    width: seg.width,
                    elevation: (seg.elevation || 0) + (Math.random() - 0.5) * this.config.elevationVolatility
                };
            }
            return seg;
        });

        // Ensure loops have straight padding
        for (let i = 0; i < dna.segments.length; i++) {
            if (dna.segments[i].type === 'loop') {
                if (i > 0 && dna.segments[i - 1].type !== 'loop') {
                    dna.segments[i - 1].bankAngle = 0;
                    dna.segments[i - 1].sweepAngle = 0;
                    dna.segments[i - 1].elevation = 0; // ensure flat entry
                    dna.segments[i - 1].radius = Math.min(dna.segments[i - 1].radius, 30); // limit padding length
                }
                if (i < dna.segments.length - 1 && dna.segments[i + 1].type !== 'loop') {
                    dna.segments[i + 1].bankAngle = 0;
                    dna.segments[i + 1].sweepAngle = 0;
                    dna.segments[i + 1].elevation = 0; // ensure flat exit
                    dna.segments[i + 1].radius = Math.min(dna.segments[i + 1].radius, 30); // limit padding length
                }
            }
        }
    }

    public run(): TrackDNA {
        this.createInitialPopulation();

        let bestTrack: TrackDNA = this.population[0];
        let bestFitness = -Infinity;

        for (let gen = 0; gen < this.config.generations; gen++) {
            const scoredPopulation = this.population.map(dna => ({
                dna,
                fitness: FitnessFunction.evaluate(dna)
            }));

            // Sort descending by fitness
            scoredPopulation.sort((a, b) => b.fitness - a.fitness);

            if (scoredPopulation[0].fitness > bestFitness) {
                bestFitness = scoredPopulation[0].fitness;
                bestTrack = JSON.parse(JSON.stringify(scoredPopulation[0].dna));
            }

            const newPopulation: TrackDNA[] = [];
            
            // Elitism: keep top 10%
            const eliteCount = Math.floor(this.config.populationSize * 0.1);
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(JSON.parse(JSON.stringify(scoredPopulation[i].dna)));
            }

            // Fill remainder
            while (newPopulation.length < this.config.populationSize) {
                const parentA = this.tournamentSelection(scoredPopulation);
                const parentB = this.tournamentSelection(scoredPopulation);
                
                const child = this.crossover(parentA, parentB);
                this.mutate(child);
                newPopulation.push(child);
            }

            this.population = newPopulation;
        }

        // Final eval
        const finalScored = this.population.map(dna => ({
            dna,
            fitness: FitnessFunction.evaluate(dna)
        }));
        finalScored.sort((a, b) => b.fitness - a.fitness);
        
        if (finalScored[0].fitness > bestFitness) {
            bestTrack = finalScored[0].dna;
        }

        return bestTrack;
    }

    private tournamentSelection(scoredPop: {dna: TrackDNA, fitness: number}[]): TrackDNA {
        const tournamentSize = 3;
        let best = scoredPop[Math.floor(Math.random() * scoredPop.length)];
        
        for (let i = 1; i < tournamentSize; i++) {
            const contender = scoredPop[Math.floor(Math.random() * scoredPop.length)];
            if (contender.fitness > best.fitness) {
                best = contender;
            }
        }
        
        return best.dna;
    }
}
