import type { TrackDNA, SplinePoint } from './types';



export type MathematicalSegment = 
    | { type: 'catmull'; points: SplinePoint[] }
    | { type: 'loop'; startPoint: SplinePoint; radius: number; drift: number; endBank: number };

export class MathOracle {
    static generateMathematicalSegments(dna: TrackDNA, samplesPerSegment: number = 10): MathematicalSegment[] {
        const segments: MathematicalSegment[] = [];
        
        let px = 0;
        let py = 0;
        let pz = 0;
        let yaw = 0; 
        
        const initialWidth = dna.segments.length > 0 ? dna.segments[0].width : 10;
        const initialBank = dna.segments.length > 0 ? dna.segments[0].bankAngle : 0;

        let currentCatmullPoints: SplinePoint[] = [];

        const pushCatmullPoint = (p: SplinePoint) => {
            currentCatmullPoints.push(p);
        };

        const flushCatmull = () => {
            if (currentCatmullPoints.length > 0) {
                segments.push({ type: 'catmull', points: currentCatmullPoints });
                currentCatmullPoints = [];
            }
        };

        pushCatmullPoint({
            position: [px, py, pz],
            width: initialWidth,
            bank: initialBank,
            isLoop: false
        });

        for (let sIdx = 0; sIdx < dna.segments.length; sIdx++) {
            const seg = dna.segments[sIdx];
            
            const startZ = pz;
            let startBank = initialBank;
            let startWidth = initialWidth;
            
            if (currentCatmullPoints.length > 0) {
                startBank = currentCatmullPoints[currentCatmullPoints.length - 1].bank;
                startWidth = currentCatmullPoints[currentCatmullPoints.length - 1].width;
            } else if (segments.length > 0) {
                const lastSeg = segments[segments.length - 1];
                if (lastSeg.type === 'catmull') {
                    startBank = lastSeg.points[lastSeg.points.length - 1].bank;
                    startWidth = lastSeg.points[lastSeg.points.length - 1].width;
                } else {
                    startBank = lastSeg.endBank; 
                    startWidth = lastSeg.startPoint.width;
                }
            }

            const deltaBank = seg.bankAngle - startBank;
            const deltaWidth = seg.width - startWidth;
            const samples = Math.max(2, samplesPerSegment);

            if (seg.type === 'loop') {
                flushCatmull();
                
                const R = Math.max(10, seg.radius); 
                const drift = seg.width * 2.0; 
                
                const startPoint: SplinePoint = {
                    position: [px, py, pz],
                    width: startWidth,
                    bank: startBank,
                    isLoop: true
                };

                segments.push({
                    type: 'loop',
                    startPoint,
                    radius: R,
                    drift: drift,
                    endBank: seg.bankAngle
                });
                
                px = px + drift * Math.sin(yaw);
                py = py - drift * Math.cos(yaw);
                yaw = yaw + Math.atan2(drift, 2 * Math.PI * R);
                pz = startZ;
                
                pushCatmullPoint({
                    position: [px, py, pz],
                    width: seg.width,
                    bank: seg.bankAngle,
                    isLoop: false
                });
                
                continue;
            }

            const isStraight = Math.abs(seg.sweepAngle) < 0.0001;
            const deltaYaw = seg.sweepAngle;
            const deltaZ = seg.elevation;
            
            for (let i = 1; i <= samples; i++) {
                const t = i / samples;
                let currPx, currPy, currPz;
                
                if (!isStraight) {
                    const R = seg.radius * Math.sign(seg.sweepAngle);
                    const cx = px - R * Math.sin(yaw);
                    const cy = py + R * Math.cos(yaw);
                    
                    currPx = cx + R * Math.sin(yaw + deltaYaw * t);
                    currPy = cy - R * Math.cos(yaw + deltaYaw * t);
                    currPz = startZ + deltaZ * t;
                } else {
                    const length = seg.radius;
                    currPx = px + length * t * Math.cos(yaw);
                    currPy = py + length * t * Math.sin(yaw);
                    currPz = startZ + deltaZ * t;
                }
                
                pushCatmullPoint({
                    position: [currPx, currPy, currPz],
                    width: startWidth + deltaWidth * t,
                    bank: startBank + deltaBank * t,
                    isLoop: false
                });
            }
            
            if (!isStraight) {
                const R = seg.radius * Math.sign(seg.sweepAngle);
                px = px - R * Math.sin(yaw) + R * Math.sin(yaw + deltaYaw);
                py = py + R * Math.cos(yaw) - R * Math.cos(yaw + deltaYaw);
            } else {
                px = px + seg.radius * Math.cos(yaw);
                py = py + seg.radius * Math.sin(yaw);
            }
            
            pz = startZ + deltaZ;
            yaw = yaw + deltaYaw;
        }
        
        flushCatmull();
        return segments;
    }
}
