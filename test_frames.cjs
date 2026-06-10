const THREE = require('three');
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -10),
  new THREE.Vector3(10, 0, -10)
], false, 'centripetal', 0.5);
const frames = curve.computeFrenetFrames(10, false);
console.log('T0:', frames.tangents[0]);
console.log('N0:', frames.normals[0]);
console.log('B0:', frames.binormals[0]);
