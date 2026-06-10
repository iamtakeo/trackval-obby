import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface TrackMeshProps {
  curve: THREE.CatmullRomCurve3;
}

export function TrackMesh({ curve }: TrackMeshProps) {
  const { geometry, pillarData } = useMemo(() => {
    // 1. Create the Track Extrusion
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

    const trackGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 2. Compute Pillar Positions
    // Drop a pillar every 5% of the track length to support it
    const numPillars = 50; 
    const pData = [];
    const groundY = -100;

    for (let i = 0; i < numPillars; i++) {
      const t = i / numPillars;
      const pos = curve.getPointAt(t);
      
      const height = pos.y - groundY;
      const centerY = groundY + height / 2;
      
      pData.push({
        x: pos.x,
        y: centerY,
        z: pos.z,
        height: height
      });
    }

    return { geometry: trackGeo, pillarData: pData };
  }, [curve]);

  // Reference for the InstancedMesh
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (instancedMeshRef.current) {
      const dummy = new THREE.Object3D();
      pillarData.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        // Scale the default 1-unit tall cylinder to the correct height
        dummy.scale.set(1, p.height, 1);
        dummy.updateMatrix();
        instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [pillarData]);

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

      {/* Concrete support pillars */}
      <instancedMesh 
        ref={instancedMeshRef} 
        args={[undefined, undefined, pillarData.length]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[2, 2.5, 1, 16]} />
        <meshStandardMaterial 
          color="#888888" 
          roughness={0.95} 
          metalness={0.0} 
        />
      </instancedMesh>
    </group>
  );
}
