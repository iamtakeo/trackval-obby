import { useMemo } from 'react';
import * as THREE from 'three';

interface TrackMeshProps {
  curve: THREE.CatmullRomCurve3;
}

export function TrackMesh({ curve }: TrackMeshProps) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const width = 10;
    const depth = 0.5;
    
    shape.moveTo(-width / 2, -depth / 2);
    shape.lineTo(width / 2, -depth / 2);
    shape.lineTo(width / 2, depth / 2);
    shape.lineTo(-width / 2, depth / 2);
    shape.lineTo(-width / 2, -depth / 2);

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 400,
      bevelEnabled: false,
      extrudePath: curve,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [curve]);

  return (
    <group>
      {/* Dark metallic road surface */}
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color="#0f0f15" 
          roughness={0.2} 
          metalness={0.9} 
        />
      </mesh>
      
      {/* Cyberpunk neon wireframe overlay */}
      <mesh geometry={geometry}>
        <meshBasicMaterial 
          color="#ff00ff" 
          wireframe={true} 
          transparent={true} 
          opacity={0.2} 
        />
      </mesh>
    </group>
  );
}
