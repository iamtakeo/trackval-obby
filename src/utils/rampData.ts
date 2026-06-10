export interface RampData {
  position: [number, number, number]; // [x, y, z] center of the base
  rotation: number; // yaw angle in radians
  width: number; // lateral width
  length: number; // longitudinal length
  height: number; // peak height
}

export const defaultRamps: RampData[] = [
  // Small jumps
  { position: [-20, 0, 20], rotation: Math.PI / 4, width: 8, length: 15, height: 3 },
  { position: [-30, 0, 30], rotation: Math.PI / 4, width: 8, length: 15, height: 3 },
  
  // Medium kicker
  { position: [0, 0, 40], rotation: 0, width: 12, length: 20, height: 6 },
  
  // Big air ramps
  { position: [40, 0, 40], rotation: -Math.PI / 4, width: 20, length: 40, height: 15 },
  { position: [60, 0, 20], rotation: -Math.PI / 2, width: 20, length: 40, height: 15 },

  // Halfpipe-style opposed ramps
  { position: [-50, 0, -20], rotation: Math.PI / 2, width: 20, length: 30, height: 10 },
  { position: [-20, 0, -20], rotation: -Math.PI / 2, width: 20, length: 30, height: 10 },
];
