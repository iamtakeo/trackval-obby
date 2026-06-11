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
            
            const startZ = pz;
            const startBank = points[points.length - 1].bank;
            const deltaBank = seg.bankAngle - startBank;
            const startWidth = points[points.length - 1].width;
            const deltaWidth = seg.width - startWidth;
            
            const samples = Math.max(2, samplesPerSegment);

            if (seg.type === 'loop') {
                const R = Math.max(10, seg.radius); // Minimum loop radius
                const drift = seg.width * 2.0; // Lateral offset to avoid intersection
                
                for (let i = 1; i <= samples; i++) {
                    const t = i / samples;
                    const angle = 2 * Math.PI * t;
                    
                    const forward = R * Math.sin(angle);
                    const lateral = drift * t; // Drifting left
                    
                    const currPx = px + forward * Math.cos(yaw) - lateral * Math.sin(yaw);
                    const currPy = py + forward * Math.sin(yaw) + lateral * Math.cos(yaw);
                    const currPz = startZ + R - R * Math.cos(angle);
                    
                    // Derivatives for tangent
                    const dForward = R * 2 * Math.PI * Math.cos(angle);
                    const dLateral = drift;
                    const dPz = R * 2 * Math.PI * Math.sin(angle);
                    
                    const tx = dForward * Math.cos(yaw) - dLateral * Math.sin(yaw);
                    const ty = dForward * Math.sin(yaw) + dLateral * Math.cos(yaw);
                    const tz = dPz;
                    
                    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
                    
                    points.push({
                        position: [currPx, currPy, currPz],
                        tangent: [tx / tLen, ty / tLen, tz / tLen],
                        normal: [0, 0, 1], // Basic normal, to be replaced by Frenet frames
                        width: startWidth + deltaWidth * t,
                        bank: startBank + deltaBank * t
                    });
                }
                
                // Advance state
                px = px - drift * Math.sin(yaw);
                py = py + drift * Math.cos(yaw);
                pz = startZ;
                // yaw remains unchanged
                continue;
            }

            // Normal curve/straight logic
            const isStraight = Math.abs(seg.sweepAngle) < 0.0001;
            const arcLength = isStraight ? seg.radius : seg.radius * Math.abs(seg.sweepAngle);
            const deltaYaw = seg.sweepAngle;
            const deltaZ = seg.elevation;
            
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
                    const length = seg.radius;
                    currPx = px + length * t * Math.cos(yaw);
                    currPy = py + length * t * Math.sin(yaw);
                    currPz = startZ + deltaZ * t;
                    
                    tx = Math.cos(yaw);
                    ty = Math.sin(yaw);
                }
                
                tz = deltaZ / (arcLength > 0.001 ? arcLength : 1);
                const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz);
                
                const nx = -Math.sin(currentYaw);
                const ny = Math.cos(currentYaw);
                
                points.push({
                    position: [currPx, currPy, currPz],
                    tangent: [tx / tLen, ty / tLen, tz / tLen],
                    normal: [nx, ny, 0],
                    width: startWidth + deltaWidth * t,
                    bank: startBank + deltaBank * t
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
        
        return points;
    }
}
