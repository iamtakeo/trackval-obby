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
    sequenceVariety: number;
    widthVolatility: number;
    isClosed: boolean;
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
            elevationVolatility: config.elevationVolatility ?? 10,
            sequenceVariety: config.sequenceVariety ?? 0.5,
            widthVolatility: config.widthVolatility ?? 5,
            isClosed: config.isClosed ?? false
        };
    }

    private randomSegment(): TrackSegmentDNA {
        const isStraight = Math.random() > this.config.turnChance;
        return {
            // straight lines have sweep 0 and radius acts as length
            radius: isStraight ? Math.random() * 50 + 20 : Math.random() * 150 + 10,
            sweepAngle: isStraight ? 0 : (Math.random() - 0.5) * Math.PI, // -90 to 90 degrees
            bankAngle: (Math.random() - 0.5) * (Math.PI / 4), // -22.5 to 22.5 degrees
            width: Math.max(5, 12 + (Math.random() - 0.5) * this.config.widthVolatility), 
            elevation: (Math.random() - 0.5) * this.config.elevationVolatility // elevation delta based on volatility
        };
    }

    private createInitialPopulation() {
        this.population = [];
        for (let i = 0; i < this.config.populationSize; i++) {
            this.population.push({
                segments: Array.from({ length: this.config.segmentsPerTrack }, () => this.randomSegment()),
                isClosed: this.config.isClosed
            });
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
        return { segments: childSegments, isClosed: this.config.isClosed };
    }

    private mutate(dna: TrackDNA) {
        for (let i = 0; i < dna.segments.length; i++) {
            if (Math.random() < this.config.mutationRate) {
                const seg = dna.segments[i];
                
                // 1. Loop check
                const isLoop = Math.random() < this.config.loopChance;
                if (isLoop) {
                    dna.segments[i] = {
                        type: 'loop',
                        radius: 15 + Math.random() * 20, // Loops need to be large enough
                        sweepAngle: 2 * Math.PI,
                        bankAngle: 0,
                        width: seg.width,
                        elevation: 0
                    };
                    continue;
                }

                // 2. Feature Macro check (15% chance to inject a macro instead of normal mutation)
                if (Math.random() < 0.15) {
                    const macroType = Math.random();
                    if (macroType < 0.25 && i < dna.segments.length - 1) {
                        // Chicane (S-Turn) - requires 2 segments
                        const sweep = (Math.random() * Math.PI / 4) + Math.PI / 6; // 30 to 75 deg
                        const radius = 20 + Math.random() * 30; // 20 to 50
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        
                        dna.segments[i] = { ...seg, type: 'normal', radius, sweepAngle: sweep * dir, bankAngle: 0, elevation: 0 };
                        dna.segments[i+1] = { ...dna.segments[i+1], type: 'normal', radius, sweepAngle: sweep * -dir, bankAngle: 0, elevation: 0 };
                        i++; // skip next segment as it is part of the chicane
                        continue;
                    } else if (macroType < 0.50) {
                        // Hairpin
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        dna.segments[i] = { ...seg, type: 'normal', radius: 15 + Math.random() * 10, sweepAngle: Math.PI * dir, bankAngle: (Math.PI/6) * dir, elevation: 0 };
                        continue;
                    } else if (macroType < 0.75) {
                        // Long Sweeper
                        const dir = Math.random() > 0.5 ? 1 : -1;
                        dna.segments[i] = { ...seg, type: 'normal', radius: 100 + Math.random() * 100, sweepAngle: (Math.PI * 0.7) * dir, bankAngle: (Math.PI/12) * dir, elevation: 0 };
                        continue;
                    } else {
                        // Camelback (Hills)
                        dna.segments[i] = { ...seg, type: 'normal', radius: 50 + Math.random() * 50, sweepAngle: 0, bankAngle: 0, elevation: 15 + Math.random() * 20 };
                        continue;
                    }
                }
                
                // 3. Normal Jitter Mutation
                const newSweep = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, (seg.sweepAngle || 0) + (Math.random() - 0.5) * Math.PI / 4));
                const newWidth = Math.max(5, (seg.width || 12) + (Math.random() - 0.5) * this.config.widthVolatility);
                dna.segments[i] = {
                    ...seg,
                    type: 'normal',
                    radius: Math.max((seg.width || 10) / 2 + 5, Math.max(10, (seg.radius || 0) + (Math.random() - 0.5) * 50)),
                    sweepAngle: Math.abs(newSweep) < 0.0001 ? 0 : newSweep,
                    bankAngle: (seg.bankAngle || 0) + (Math.random() - 0.5) * 0.2,
                    width: newWidth,
                    elevation: (seg.elevation || 0) + (Math.random() - 0.5) * this.config.elevationVolatility
                };
            }
        }

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

        for (let gen = 0; gen < this.config.generations; gen++) {
            const scoredPopulation = this.population.map(dna => ({
                dna,
                fitness: FitnessFunction.evaluate(dna, this.config.sequenceVariety, this.config.isClosed)
            }));

            // Sort descending by fitness
            scoredPopulation.sort((a, b) => b.fitness - a.fitness);

            const eliteCount = Math.floor(this.config.populationSize * 0.1);
            const elite = scoredPopulation.slice(0, eliteCount).map(s => s.dna);
            const offspring: TrackDNA[] = [];

            while (offspring.length + elite.length < this.config.populationSize) {
                const parentA = this.tournamentSelection(scoredPopulation);
                const parentB = this.tournamentSelection(scoredPopulation);
                
                const child = this.crossover(parentA, parentB);
                this.mutate(child);
                offspring.push(child);
            }

            this.population = [...elite, ...offspring];
        }

        const finalScored = this.population.map(dna => ({
            dna,
            fitness: FitnessFunction.evaluate(dna, this.config.sequenceVariety, this.config.isClosed)
        }));
        finalScored.sort((a, b) => b.fitness - a.fitness);

        return finalScored[0].dna;
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
