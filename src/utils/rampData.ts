export interface RampData {
  position: [number, number, number]; // [x, y, z] center of the base
  rotation: number; // yaw angle in radians
  width: number; // lateral width
  length: number; // longitudinal length
  height: number; // peak height
}

export function generateRamps(frequency: number): RampData[] {
  const ramps: RampData[] = [];
  const areaSize = 150; // scatter around origin +/- 150m

  for (let i = 0; i < frequency; i++) {
    ramps.push({
      position: [(Math.random() - 0.5) * areaSize * 2, 0, (Math.random() - 0.5) * areaSize * 2],
      rotation: Math.random() * Math.PI * 2,
      width: 8 + Math.random() * 12, // 8 to 20m
      length: 15 + Math.random() * 25, // 15 to 40m
      height: 3 + Math.random() * 12, // 3 to 15m
    });
  }

  return ramps;
}

export const defaultRamps: RampData[] = generateRamps(8);
