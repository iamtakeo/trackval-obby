import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { CarAppearance } from '../store';

interface CarModelProps {
  appearance?: CarAppearance;
  isGhost?: boolean;
}

export function CarModel({ appearance, isGhost = false }: CarModelProps) {
  const defaultAppearance: CarAppearance = {
    bodyStyle: 'speedster',
    primaryColor: '#00e5ff',
    secondaryColor: '#ffffff',
    thrusterColor: '#ff0055',
    decalStyle: 'none',
    spoiler: 'none',
    underglow: false,
    underglowColor: '#00e5ff',
    accessory: 'none'
  };

  const config = appearance || defaultAppearance;
  
  const opacity = isGhost ? 0.3 : 1.0;
  const transparent = isGhost;
  
  // Materials
  const primaryMat = <meshStandardMaterial color={config.primaryColor} roughness={0.2} metalness={0.9} transparent={transparent} opacity={opacity} />;
  const secondaryMat = <meshStandardMaterial color={config.secondaryColor} roughness={0.3} metalness={0.5} transparent={transparent} opacity={opacity} />;
  const darkMat = <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={1} transparent={transparent} opacity={opacity} />;
  const glassMat = <meshStandardMaterial color="#ffffff" roughness={0.0} metalness={0.8} transparent={true} opacity={isGhost ? 0.2 : 0.6} />;
  const engineMat = <meshBasicMaterial color={config.thrusterColor} transparent={transparent} opacity={opacity} />;
  const underglowMat = <meshBasicMaterial color={config.underglowColor} transparent={transparent} opacity={opacity} />;

  // Animation refs for police sirens
  const sirenLight1 = useRef<THREE.PointLight>(null);
  const sirenLight2 = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (config.accessory === 'police-sirens' && !isGhost) {
      const t = clock.elapsedTime * 10;
      if (sirenLight1.current) sirenLight1.current.intensity = Math.sin(t) > 0 ? 5 : 0;
      if (sirenLight2.current) sirenLight2.current.intensity = Math.sin(t) < 0 ? 5 : 0;
    }
  });

  // 1. Modular Decals
  const renderDecals = (roofY: number, length: number) => {
    if (config.decalStyle === 'racing-stripes') {
      return (
        <group position={[0, roofY + 0.01, 0]}>
          <mesh position={[-0.4, 0, 0]}><boxGeometry args={[0.2, 0.05, length]} />{secondaryMat}</mesh>
          <mesh position={[0.4, 0, 0]}><boxGeometry args={[0.2, 0.05, length]} />{secondaryMat}</mesh>
        </group>
      );
    }
    if (config.decalStyle === 'hazard') {
      return (
        <group position={[0, roofY - 0.2, 0]}>
          <mesh position={[1.11, 0, 0]}><boxGeometry args={[0.05, 0.4, length * 0.8]} />{secondaryMat}</mesh>
          <mesh position={[-1.11, 0, 0]}><boxGeometry args={[0.05, 0.4, length * 0.8]} />{secondaryMat}</mesh>
        </group>
      );
    }
    if (config.decalStyle === 'checkered') {
       return (
         <group position={[0, roofY + 0.01, 0]}>
           <mesh position={[0, 0, -1]}><boxGeometry args={[1.5, 0.05, 1.0]} />{secondaryMat}</mesh>
           <mesh position={[0, 0, 1]}><boxGeometry args={[1.5, 0.05, 1.0]} />{secondaryMat}</mesh>
         </group>
       );
    }
    return null;
  };

  // 2. Modular Spoilers
  const renderSpoiler = (rearZ: number, rearY: number) => {
    if (config.spoiler === 'ducktail') {
      return (
        <mesh position={[0, rearY + 0.1, rearZ - 0.2]} rotation={[Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2.0, 0.4, 0.1]} />
          {secondaryMat}
        </mesh>
      );
    }
    if (config.spoiler === 'gt-wing') {
      return (
        <group position={[0, rearY, rearZ - 0.2]}>
          <mesh position={[-0.8, 0.4, 0]}><boxGeometry args={[0.1, 0.8, 0.2]} />{darkMat}</mesh>
          <mesh position={[0.8, 0.4, 0]}><boxGeometry args={[0.1, 0.8, 0.2]} />{darkMat}</mesh>
          <mesh position={[0, 0.8, 0]}><boxGeometry args={[2.6, 0.1, 0.6]} />{secondaryMat}</mesh>
          {/* Side fins */}
          <mesh position={[-1.3, 0.8, 0]}><boxGeometry args={[0.05, 0.4, 0.8]} />{primaryMat}</mesh>
          <mesh position={[1.3, 0.8, 0]}><boxGeometry args={[0.05, 0.4, 0.8]} />{primaryMat}</mesh>
        </group>
      );
    }
    if (config.spoiler === 'cyber') {
      return (
        <group position={[0, rearY + 0.3, rearZ]}>
          <mesh position={[-1.0, 0.5, 0]} rotation={[0, 0, -Math.PI / 8]}><boxGeometry args={[0.1, 1.2, 0.8]} />{engineMat}</mesh>
          <mesh position={[1.0, 0.5, 0]} rotation={[0, 0, Math.PI / 8]}><boxGeometry args={[0.1, 1.2, 0.8]} />{engineMat}</mesh>
        </group>
      );
    }
    return null;
  };

  // 3. Modular Accessories
  const renderAccessory = (roofY: number, frontZ: number) => {
    if (config.accessory === 'antenna') {
      return (
        <group position={[-0.8, roofY, -frontZ + 0.5]}>
          <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.02, 0.05, 1.6]} />{darkMat}</mesh>
          <mesh position={[0, 1.6, 0]}><sphereGeometry args={[0.1]} />{engineMat}</mesh>
        </group>
      );
    }
    if (config.accessory === 'spikes') {
      return (
        <group position={[0, 0, -frontZ - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[-0.8, 0, 0]}><coneGeometry args={[0.1, 0.6]} />{secondaryMat}</mesh>
          <mesh position={[-0.4, 0, 0]}><coneGeometry args={[0.1, 0.6]} />{secondaryMat}</mesh>
          <mesh position={[0, 0, 0]}><coneGeometry args={[0.1, 0.6]} />{secondaryMat}</mesh>
          <mesh position={[0.4, 0, 0]}><coneGeometry args={[0.1, 0.6]} />{secondaryMat}</mesh>
          <mesh position={[0.8, 0, 0]}><coneGeometry args={[0.1, 0.6]} />{secondaryMat}</mesh>
        </group>
      );
    }
    if (config.accessory === 'police-sirens') {
      return (
        <group position={[0, roofY + 0.4, -0.2]}>
          <mesh position={[-0.4, 0, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.3]} />
            <meshBasicMaterial color="#ff0000" transparent={transparent} opacity={opacity} />
            {!isGhost && <pointLight ref={sirenLight1} color="#ff0000" distance={15} intensity={0} />}
          </mesh>
          <mesh position={[0.4, 0, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.3]} />
            <meshBasicMaterial color="#0000ff" transparent={transparent} opacity={opacity} />
            {!isGhost && <pointLight ref={sirenLight2} color="#0000ff" distance={15} intensity={0} />}
          </mesh>
          <mesh position={[0, -0.1, 0]}><boxGeometry args={[1.2, 0.1, 0.4]} />{darkMat}</mesh>
        </group>
      );
    }
    return null;
  };

  // 4. Underglow
  const renderUnderglow = (length: number, width: number) => {
    if (!config.underglow) return null;
    return (
      <group position={[0, -0.3, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width * 0.8, length * 0.8]} />
          {underglowMat}
        </mesh>
        {!isGhost && <pointLight color={config.underglowColor} intensity={3} distance={8} position={[0, -0.5, 0]} />}
      </group>
    );
  };

  // Render the core body
  let coreBody = null;
  let attachPoints = { roofY: 0.3, rearY: 0.3, rearZ: 2.25, frontZ: 2.25, length: 4.5, width: 2.2 };

  switch (config.bodyStyle) {
    case 'brute':
      attachPoints = { roofY: 0.4, rearY: 0.4, rearZ: 2.0, frontZ: 2.0, length: 4.0, width: 3.0 };
      coreBody = (
        <group>
          <mesh position={[0, 0, 0]}><boxGeometry args={[3.0, 0.8, 4.0]} />{primaryMat}</mesh>
          <mesh position={[0, 0.45, 0]}><boxGeometry args={[3.2, 0.2, 3.0]} />{darkMat}</mesh>
          <mesh position={[0, 0.6, -0.5]}><boxGeometry args={[2.0, 0.3, 1.0]} />{glassMat}</mesh>
          <mesh position={[-0.8, 0, 2.1]}><boxGeometry args={[0.8, 0.5, 0.2]} />{engineMat}</mesh>
          <mesh position={[0.8, 0, 2.1]}><boxGeometry args={[0.8, 0.5, 0.2]} />{engineMat}</mesh>
          {!isGhost && <pointLight color={config.thrusterColor} intensity={2} distance={10} position={[0, 0, 2.5]} />}
        </group>
      );
      break;
      
    case 'interceptor':
      attachPoints = { roofY: 0.6, rearY: 0.2, rearZ: 1.5, frontZ: 2.5, length: 5.0, width: 3.5 };
      coreBody = (
        <group>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}><coneGeometry args={[1.5, 5.0, 4]} />{primaryMat}</mesh>
          <mesh position={[0, 0.2, 1.5]}><boxGeometry args={[3.5, 0.1, 1.0]} />{darkMat}</mesh>
          <mesh position={[-1.7, 0.5, 1.5]}><boxGeometry args={[0.1, 0.8, 1.0]} />{primaryMat}</mesh>
          <mesh position={[1.7, 0.5, 1.5]}><boxGeometry args={[0.1, 0.8, 1.0]} />{primaryMat}</mesh>
          <mesh position={[0, 0.4, -0.5]}><boxGeometry args={[1.0, 0.4, 1.5]} />{glassMat}</mesh>
          <mesh position={[0, 0, 2.0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.6, 0.8, 0.5, 16]} />{engineMat}</mesh>
          {!isGhost && <pointLight color={config.thrusterColor} intensity={2.5} distance={15} position={[0, 0, 2.5]} />}
        </group>
      );
      break;
      
    case 'speedster':
    default:
      attachPoints = { roofY: 0.3, rearY: 0.3, rearZ: 2.25, frontZ: 2.25, length: 4.5, width: 2.2 };
      coreBody = (
        <group>
          <mesh position={[0, 0, 0]}><boxGeometry args={[2.2, 0.6, 4.5]} />{primaryMat}</mesh>
          <mesh position={[0, 0.5, -0.5]}><boxGeometry args={[1.6, 0.6, 2.2]} />{glassMat}</mesh>
          <mesh position={[0, 0, 2.3]}><boxGeometry args={[1.8, 0.3, 0.2]} />{engineMat}</mesh>
          {!isGhost && <pointLight color={config.thrusterColor} intensity={2} distance={10} position={[0, 0, 2.5]} />}
        </group>
      );
      break;
  }

  return (
    <group rotation={[0, Math.PI, 0]}>
      {coreBody}
      {renderDecals(attachPoints.roofY, attachPoints.length)}
      {renderSpoiler(attachPoints.rearZ, attachPoints.rearY)}
      {renderAccessory(attachPoints.roofY, attachPoints.frontZ)}
      {renderUnderglow(attachPoints.length, attachPoints.width)}
    </group>
  );
}
