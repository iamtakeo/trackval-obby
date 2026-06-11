import * as THREE from 'three';
import type { TrackGeometry } from './CartesianPhysics';

export class CartesianTrackAdapter implements TrackGeometry {
  curve: THREE.Curve<THREE.Vector3>;
  frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[], widths: number[] };

  constructor(curve: THREE.Curve<THREE.Vector3>, frames: { tangents: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[], widths: number[] }) {
    this.curve = curve;
    this.frames = frames;
  }

  getTotalLength(): number {
    return this.curve.getLength();
  }

  private getT(s: number): number {
    const totalLength = this.getTotalLength();
    let t = s / totalLength;
    t = Math.max(0, Math.min(1, t));
    return t;
  }

  private getInterpolatedVector(vectors: THREE.Vector3[], t: number): THREE.Vector3 {
    const floatIndex = t * (vectors.length - 1);
    const index = Math.floor(floatIndex);
    const fraction = floatIndex - index;

    if (index >= vectors.length - 1) return vectors[vectors.length - 1].clone();

    const v1 = vectors[index];
    const v2 = vectors[index + 1];
    return new THREE.Vector3().copy(v1).lerp(v2, fraction).normalize();
  }

  getCartesian(s: number, u: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    const point = this.curve.getPointAt(t);
    // Binormal is used for lateral offset
    const binormal = this.getInterpolatedVector(this.frames.binormals, t);
    return point.add(binormal.multiplyScalar(u));
  }

  getNormal(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.normals, t);
  }

  getBinormal(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.binormals, t);
  }

  getTangent(s: number): { x: number; y: number; z: number } {
    const t = this.getT(s);
    return this.getInterpolatedVector(this.frames.tangents, t);
  }

  getWidth(s: number): number {
    const t = this.getT(s);
    const floatIndex = t * (this.frames.widths.length - 1);
    const index = Math.floor(floatIndex);
    const fraction = floatIndex - index;

    if (index >= this.frames.widths.length - 1) return this.frames.widths[this.frames.widths.length - 1];

    const w1 = this.frames.widths[index];
    const w2 = this.frames.widths[index + 1];
    return w1 + (w2 - w1) * fraction;
  }
}
