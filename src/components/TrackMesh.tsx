import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { TrackData } from '../utils/trackGenerator';

interface TrackMeshProps {
  trackData: TrackData;
}

export function TrackMesh({ trackData }: TrackMeshProps) {
  const { geometry, pillarData } = useMemo(() => {
    // 1. Create the Track Extrusion
    const shape = new THREE.Shape();
    const width = 12;
    const depth = 1;
    
    // Through visual confirmation, ExtrudeGeometry maps Shape X to the vertical vector, and Shape Y to the horizontal vector.
    // To make the track lay flat, Shape X must be depth (thickness) and Shape Y must be width.
    shape.moveTo(-depth / 2, -width / 2);
    shape.lineTo(depth / 2, -width / 2);
    shape.lineTo(depth / 2, width / 2);
    shape.lineTo(-depth / 2, width / 2);
    shape.lineTo(-depth / 2, -width / 2);

    const extrudeSettings = {
      steps: 400,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.2,
      bevelThickness: 0.2,
      extrudePath: trackData.curve,
    } as any;

    // ExtrudeGeometry completely ignores the `frames` property in modern Three.js,
    // and calculates its own un-banked FrenetFrames internally.
    // By overriding the method on the curve instance, we force it to use our custom banked frames!
    trackData.curve.computeFrenetFrames = () => trackData.frames;

    const trackGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // 2. Compute Pillar Positions
    const numPillars = 50; 
    const pData = [];
    const groundY = 0; // Fix grass height

    // Pre-sample track points for intersection checks
    const trackSamples: THREE.Vector3[] = [];
    const sampleCount = 200;
    for (let i = 0; i <= sampleCount; i++) {
        trackSamples.push(trackData.curve.getPointAt(i / sampleCount));
    }

    for (let i = 0; i < numPillars; i++) {
      const t = i / numPillars;
      const pos = trackData.curve.getPointAt(t);
      
      const frameIndex = Math.round(t * (trackData.frames.normals.length - 1));
      const normal = trackData.frames.normals[frameIndex];
      
      // Skip pillars if track is steep, banked, or upside down
      if (normal.y < 0.5) {
          continue;
      }

      // Skip pillars if there's a track segment directly below this point
      let trackDirectlyBelow = false;
      for (const sample of trackSamples) {
          const dx = sample.x - pos.x;
          const dz = sample.z - pos.z;
          const distSq = dx * dx + dz * dz;
          if (distSq < 15 * 15 && sample.y < pos.y - 5) {
              trackDirectlyBelow = true;
              break;
          }
      }

      if (trackDirectlyBelow) {
          continue;
      }
      
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
  }, [trackData]);

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
        frustumCulled={false}
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
