import * as THREE from 'three';
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -10),
  new THREE.Vector3(10, 0, -10)
], false, 'centripetal', 0.5);
const frames = curve.computeFrenetFrames(10, false);
console.log('Tangent:', frames.tangents[5]);
console.log('Normal:', frames.normals[5]);
console.log('Binormal:', frames.binormals[5]);
