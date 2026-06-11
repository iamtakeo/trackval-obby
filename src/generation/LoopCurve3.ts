import * as THREE from 'three';

export class LoopCurve3 extends THREE.Curve<THREE.Vector3> {
    public startPos: THREE.Vector3;
    public startTangent: THREE.Vector3;
    public radius: number;
    public drift: number;

    constructor(startPos: THREE.Vector3, startTangent: THREE.Vector3, radius: number, drift: number) {
        super();
        this.startPos = startPos.clone();
        this.startTangent = startTangent.clone().normalize();
        this.radius = radius;
        this.drift = drift;
    }

    getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
        const angle = t * 2 * Math.PI;

        const forwardOffset = this.radius * Math.sin(angle);
        const upOffset = this.radius - this.radius * Math.cos(angle);
        const lateralOffset = this.drift * t;

        // Since startTangent is guaranteed to be purely horizontal (yaw) in our generation logic,
        // global UP (0,1,0) is orthogonal to startTangent.
        const upVec = new THREE.Vector3(0, 1, 0);
        
        // Lateral axis is cross(tangent, UP)
        const lateralVec = new THREE.Vector3().crossVectors(this.startTangent, upVec).normalize();

        const point = this.startPos.clone()
            .add(this.startTangent.clone().multiplyScalar(forwardOffset))
            .add(upVec.multiplyScalar(upOffset))
            .add(lateralVec.multiplyScalar(lateralOffset));

        return optionalTarget.copy(point);
    }
}
