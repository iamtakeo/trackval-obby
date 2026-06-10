import { useMemo } from 'react';
import * as THREE from 'three';
import { defaultRamps } from '../utils/rampData';

export function RampsMesh() {
  const rampsGeo = useMemo(() => {
    // We can merge all ramp geometries into one for performance, or just render them as separate meshes.
    // Let's render them as an array of meshes to allow frustum culling.
    return defaultRamps.map((ramp, index) => {
      // Create a wedge shape on XY plane:
      // X = length, Y = height
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); // Start of ramp
      
      // Use a quadratic curve (t^2) so it starts flat and gets steep
      const curveSegments = 20;
      for (let i = 1; i <= curveSegments; i++) {
        const t = i / curveSegments;
        const curveT = t * t;
        shape.lineTo(ramp.length * t, ramp.height * curveT);
      }
      
      shape.lineTo(ramp.length, 0); // Base of peak
      shape.lineTo(0, 0);

      const extrudeSettings = {
        steps: 1,
        depth: ramp.width,
        bevelEnabled: false,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Center the geometry along the extrusion axis (Z) so it's centered on width
      geometry.translate(0, 0, -ramp.width / 2);
      
      // The geometry is currently: length along X, height along Y, width along Z.
      // We want length along Z, height along Y, width along X.
      // Rotate -90 degrees around Y axis.
      geometry.rotateY(-Math.PI / 2);
      
      // Now: start of ramp is at Z=0. Peak is at Z = length. Width goes from -width/2 to +width/2.
      // So the car enters at Z=0 and drives towards +Z.

      return (
        <mesh 
          key={index}
          geometry={geometry}
          position={new THREE.Vector3(...ramp.position)}
          rotation={[0, ramp.rotation, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#888888" roughness={0.9} />
        </mesh>
      );
    });
  }, []);

  return <>{rampsGeo}</>;
}
