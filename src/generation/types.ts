export interface TrackSegmentDNA {
    radius: number;      // Radius of curvature (if > 0, curved. if 0, we can treat it as a straight segment where radius acts as length)
    sweepAngle: number;  // Angle of the curve in radians. Positive = left turn, Negative = right turn.
    bankAngle: number;   // Bank angle in radians.
    width: number;       // Track width in meters.
    elevation: number;   // Delta elevation in meters.
}

export interface TrackDNA {
    segments: TrackSegmentDNA[];
}

export interface SplinePoint {
    position: [number, number, number]; // [x, y, z]
    tangent: [number, number, number];  // Normalized forward vector
    normal: [number, number, number];   // Normalized up/side vector for track orientation
    width: number;
    bank: number;
}
