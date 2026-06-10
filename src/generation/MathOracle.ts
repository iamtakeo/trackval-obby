import type { TrackDNA, SplinePoint } from './types';

export class MathOracle {
    /**
     * Converts a TrackDNA sequence into an array of 3D SplinePoints.
     * @param dna The generated DNA
     * @param samplesPerSegment How many spline points to generate per segment
     * @returns An array of SplinePoints representing the track center line and orientation
     */
    static generateSpline(dna: TrackDNA, samplesPerSegment: number = 10): SplinePoint[] {
        const points: SplinePoint[] = [];
        
        let px = 0;
        let py = 0;
        let pz = 0;
        let yaw = 0; 
        
        const initialWidth = dna.segments.length > 0 ? dna.segments[0].width : 10;
        const initialBank = dna.segments.length > 0 ? dna.segments[0].bankAngle : 0;

        points.push({
            position: [px, py, pz],
            tangent: [Math.cos(yaw), Math.sin(yaw), 0],
            normal: [-Math.sin(yaw), Math.cos(yaw), 0],
            width: initialWidth,
            bank: initialBank
        });

        for (let sIdx = 0; sIdx < dna.segments.length; sIdx++) {
            const seg = dna.segments[sIdx];
            
            // To safely avoid division by zero
            const isStraight = Math.abs(seg.sweepAngle) < 0.0001;
            
            // Length of the segment
            const arcLength = isStraight ? seg.radius : seg.radius * Math.abs(seg.sweepAngle);
            const deltaYaw = seg.sweepAngle;
            
            const startZ = pz;
            const deltaZ = seg.elevation;
            
            const startBank = points[points.length - 1].bank;
            const deltaBank = seg.bankAngle - startBank;
            
            const startWidth = points[points.length - 1].width;
            const deltaWidth = seg.width - startWidth;
            
            const samples = Math.max(2, samplesPerSegment);

            for (let i = 1; i <= samples; i++) {
                const t = i / samples;
                const currentYaw = yaw + deltaYaw * t;
                
                let currPx, currPy, currPz;
                let tx, ty, tz;
                
                if (!isStraight) {
                    const R = seg.radius * Math.sign(seg.sweepAngle);
                    const cx = px - R * Math.sin(yaw);
                    const cy = py + R * Math.cos(yaw);
                    
                    currPx = cx + R * Math.sin(yaw + deltaYaw * t);
                    currPy = cy - R * Math.cos(yaw + deltaYaw * t);
                    currPz = startZ + deltaZ * t;
                    
                    tx = Math.cos(currentYaw);
                    ty = Math.sin(currentYaw);
                } else {
                    const length = seg.radius; // When sweepAngle ~ 0, radius acts as length
                    currPx = px + length * t * Math.cos(yaw);
                    currPy = py + length * t * Math.sin(yaw);
                    currPz = startZ + deltaZ * t;
                    
                    tx = Math.cos(yaw);
                    ty = Math.sin(yaw);
                }
                
                tz = deltaZ / (arcLength > 0.001 ? arcLength : 1);
                const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
                
                // Normal without bank (pointing left)
                const nx = -Math.sin(currentYaw);
                const ny = Math.cos(currentYaw);
                
                points.push({
                    position: [currPx, currPy, currPz],
                    tangent: [tx / tLen, ty / tLen, tz / tLen],
                    normal: [nx, ny, 0], // True 3D normal requires cross products with bank, keeping it simple in XY for base
                    width: startWidth + deltaWidth * t,
                    bank: startBank + deltaBank * t
                });
            }
            
            // Advance state
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
        
        return points;
    }
}
