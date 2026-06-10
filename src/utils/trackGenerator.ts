import * as THREE from 'three';

export function generateTrackCurve(): THREE.CatmullRomCurve3 {
  // Procedural track DNA: a sequence of points to define a rollercoaster-like path
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(50, 20, -100),
    new THREE.Vector3(150, -10, -150),
    new THREE.Vector3(200, 30, -250),
    new THREE.Vector3(100, 50, -350),
    new THREE.Vector3(-50, -20, -300),
    new THREE.Vector3(-150, 10, -200),
    new THREE.Vector3(-100, 40, -50),
    new THREE.Vector3(0, 0, 0), // Close the loop
  ];

  // Set closed=true to make it a continuous looping track
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  return curve;
}
