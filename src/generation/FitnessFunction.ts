import type { TrackDNA } from './types';

export class FitnessFunction {
    /**
     * Evaluates a track DNA on variance, smoothness, and thrill.
     */
    static evaluate(dna: TrackDNA, sequenceVariety: number = 0.5): number {
        if (dna.segments.length === 0) return 0;

        let fitness = 0;
        
        const segments = dna.segments;
        const n = segments.length;
        
        // --- 1. Variance (Reward variety in the track) ---
        let avgRadius = 0, avgSweep = 0, avgElev = 0, avgBank = 0;
        for (const s of segments) {
            avgRadius += s.radius;
            avgSweep += s.sweepAngle;
            avgElev += s.elevation;
            avgBank += s.bankAngle;
        }
        avgRadius /= n; avgSweep /= n; avgElev /= n; avgBank /= n;
        
        let varRadius = 0, varSweep = 0, varElev = 0, varBank = 0;
        for (const s of segments) {
            varRadius += Math.pow(s.radius - avgRadius, 2);
            varSweep += Math.pow(s.sweepAngle - avgSweep, 2);
            varElev += Math.pow(s.elevation - avgElev, 2);
            varBank += Math.pow(s.bankAngle - avgBank, 2);
        }
        varRadius = Math.sqrt(varRadius / n);
        varSweep = Math.sqrt(varSweep / n);
        varElev = Math.sqrt(varElev / n);
        varBank = Math.sqrt(varBank / n);
        
        const varianceScore = (varRadius * 0.1) + (varSweep * 10) + (varElev * 2) + (varBank * 10);
        fitness += varianceScore;
        
        // --- 2. Smoothness (Penalize jerk) & Spirals & Sequence Repetition ---
        let jerkPenalty = 0;
        let accumulatedSweep = 0;
        let repetitionPenalty = 0;
        
        for (let i = 1; i < n; i++) {
            const prev = segments[i - 1];
            const curr = segments[i];
            
            // Repetition Penalty logic
            let isRepeat = false;
            if (prev.type === 'loop' && curr.type === 'loop') {
                isRepeat = true;
            } else if (prev.type !== 'loop' && curr.type !== 'loop') {
                const prevIsStraight = Math.abs(prev.sweepAngle) < 0.0001;
                const currIsStraight = Math.abs(curr.sweepAngle) < 0.0001;
                
                if (prevIsStraight && currIsStraight) {
                    isRepeat = true;
                } else if (!prevIsStraight && !currIsStraight && Math.sign(prev.sweepAngle) === Math.sign(curr.sweepAngle)) {
                    isRepeat = true; // both curve left or both curve right
                }
            }

            if (isRepeat) {
                repetitionPenalty += 1000 * sequenceVariety;
            }

            // Accumulate sweep to prevent spirals of death
            if (curr.type !== 'loop') {
                if (Math.sign(curr.sweepAngle) === Math.sign(accumulatedSweep) || accumulatedSweep === 0) {
                    accumulatedSweep += curr.sweepAngle;
                } else {
                    accumulatedSweep = curr.sweepAngle; // Reset if direction changes
                }
                
                if (Math.abs(accumulatedSweep) > 2 * Math.PI) {
                    jerkPenalty += Math.abs(accumulatedSweep) * 1000; // Massive penalty for infinite spirals
                }
            }

            const getCurvature = (r: number, sweep: number) => 
                Math.abs(sweep) < 0.0001 ? 0 : 1 / Math.max(r, 1);
            
            const kPrev = getCurvature(prev.radius, prev.sweepAngle) * Math.sign(prev.sweepAngle);
            const kCurr = getCurvature(curr.radius, curr.sweepAngle) * Math.sign(curr.sweepAngle);
            
            const deltaK = Math.abs(kCurr - kPrev);
            const deltaBank = Math.abs(curr.bankAngle - prev.bankAngle);
            const deltaElev = Math.abs(curr.elevation - prev.elevation);
            
            jerkPenalty += (deltaK * 500) + (deltaBank * 50) + (deltaElev * 2);
        }
        fitness -= jerkPenalty;
        fitness -= repetitionPenalty;
        
        // --- 3. Thrill Bonus ---
        let thrillBonus = 0;
        for (const s of segments) {
            // Reward high banking
            thrillBonus += Math.abs(s.bankAngle) * 15;
            
            // Reward steep drops
            if (s.elevation < -5) {
                thrillBonus += Math.abs(s.elevation) * 2;
            }
            
            // Reward tight turns (radius between 10 and 40)
            if (s.radius >= 10 && s.radius <= 40 && Math.abs(s.sweepAngle) > 0.5) {
                thrillBonus += (40 / s.radius) * 10;
            }
        }
        fitness += thrillBonus;

        return Math.max(0, fitness + 1000); // Shift to keep positive
    }
}
