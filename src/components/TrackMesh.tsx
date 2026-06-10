import { useMemo } from 'react';
import * as THREE from 'three';

interface TrackMeshProps {
  curve: THREE.CatmullRomCurve3;
}

export function TrackMesh({ curve }: TrackMeshProps) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 12;
    const depth = 1;
    
    shape.moveTo(-width / 2, -depth / 2);
    shape.lineTo(width / 2, -depth / 2);
    shape.lineTo(width / 2, depth / 2);
    shape.lineTo(-width / 2, depth / 2);
    shape.lineTo(-width / 2, -depth / 2);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 400,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.2,
      bevelThickness: 0.2,
      extrudePath: curve,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [curve]);

  return (
    <group>
      {/* Solid asphalt/concrete track */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial 
          color="#555555" 
          roughness={0.9} 
          metalness={0.1} 
        />
      </mesh>
    </group>
  );
}
