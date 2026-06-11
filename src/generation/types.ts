export interface TrackSegmentDNA {
    type?: 'normal' | 'loop';
    radius: number;      // Radius of curvature (if > 0, curved. if 0, we can treat it as a straight segment where radius acts as length)
    sweepAngle: number;  // Angle of the curve in radians. Positive = left turn, Negative = right turn.
    bankAngle: number;   // Bank angle in radians.
    width: number;       // Track width in meters.
    elevation: number;   // Delta elevation in meters.
}

export interface TrackDNA {
    segments: TrackSegmentDNA[];
    isClosed?: boolean;
}

export interface SplinePoint {
    position: [number, number, number]; // [x, y, z]
    width: number;
    bank: number;
    isLoop?: boolean;
}
