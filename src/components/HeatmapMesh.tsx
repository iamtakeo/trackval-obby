import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { gameStore } from '../store';
import type { BotTelemetry } from '../store';

export function HeatmapMesh() {
  const [telemetry, setTelemetry] = useState<BotTelemetry[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const unsubscribe = gameStore.subscribe(() => {
      setTelemetry([...gameStore.getTelemetry()]);
      setShowHeatmap(gameStore.getShowHeatmap());
    });
    return unsubscribe;
  }, []);

  // Compute instances based on telemetry data
  // Using an InstancedMesh to render glowing red spheres at failure points
  useEffect(() => {
    if (!instancedMeshRef.current || !showHeatmap) return;

    const failures = telemetry.filter(t => t.reason !== 'Success');
    instancedMeshRef.current.count = failures.length;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color('#ff0000');
    
    failures.forEach((t, i) => {
      dummy.position.set(t.position.x, t.position.y + 1, t.position.z);
      // Give it a slightly random rotation and scale for a chaotic organic look
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 2 + Math.random() * 2;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      
      instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);
      instancedMeshRef.current!.setColorAt(i, color);
    });
    
    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    if (instancedMeshRef.current.instanceColor) {
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [telemetry, showHeatmap]);

  if (!showHeatmap || telemetry.length === 0) return null;

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[undefined, undefined, 1000]} // Pre-allocate up to 1000 failures
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial 
        color="#ff0000" 
        transparent={true} 
        opacity={0.3} 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
