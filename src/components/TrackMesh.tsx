import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { TrackData } from '../utils/trackGenerator';

interface TrackMeshProps {
  trackData: TrackData;
}

export function TrackMesh({ trackData }: TrackMeshProps) {
  const { geometry, pillarData } = useMemo(() => {
    // 1. Create the Track BufferGeometry
    const steps = 800;
    const depth = 1.0;
    
    const positions: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const pos = trackData.curve.getPointAt(u);
      
      const width = trackData.frames.widths[i] || 12;
      const normal = trackData.frames.normals[i];
      const binormal = trackData.frames.binormals[i];
      
      // Top surface left/right
      const topOffset = normal.clone().multiplyScalar(depth / 2);
      const bottomOffset = normal.clone().multiplyScalar(-depth / 2);
      const leftOffset = binormal.clone().multiplyScalar(-width / 2);
      const rightOffset = binormal.clone().multiplyScalar(width / 2);

      const tl = pos.clone().add(topOffset).add(leftOffset);
      const tr = pos.clone().add(topOffset).add(rightOffset);
      const bl = pos.clone().add(bottomOffset).add(leftOffset);
      const br = pos.clone().add(bottomOffset).add(rightOffset);

      positions.push(
        tl.x, tl.y, tl.z,
        tr.x, tr.y, tr.z,
        bl.x, bl.y, bl.z,
        br.x, br.y, br.z
      );

      if (i < steps) {
        const row = i * 4;
        let nextRow = (i + 1) * 4;

        if (trackData.dna?.isClosed && i === steps - 1) {
            nextRow = 0; // Weld the seam back to the start!
        }

        // Top face
        indices.push(row, row + 1, nextRow);
        indices.push(row + 1, nextRow + 1, nextRow);

        // Bottom face
        indices.push(row + 2, nextRow + 2, row + 3);
        indices.push(row + 3, nextRow + 2, nextRow + 3);

        // Left face
        indices.push(row + 2, row, nextRow + 2);
        indices.push(row, nextRow, nextRow + 2);

        // Right face
        indices.push(row + 1, row + 3, nextRow + 1);
        indices.push(row + 3, nextRow + 3, nextRow + 1);
      }
    }

    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();

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
