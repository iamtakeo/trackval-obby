import * as THREE from 'three';

const c = new THREE.PerspectiveCamera();
c.lookAt(new THREE.Vector3(1, 0, 0));
const v = new THREE.Vector3(0, 0, -1);
v.applyQuaternion(c.quaternion);
console.log('Camera local -Z:', v);

const m = new THREE.Mesh();
m.lookAt(new THREE.Vector3(1, 0, 0));
const v2 = new THREE.Vector3(0, 0, 1);
v2.applyQuaternion(m.quaternion);
console.log('Mesh local +Z:', v2);

const v3 = new THREE.Vector3(0, 0, -1);
v3.applyQuaternion(m.quaternion);
console.log('Mesh local -Z:', v3);
