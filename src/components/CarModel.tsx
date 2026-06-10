import type { CarAppearance } from '../store';

interface CarModelProps {
  appearance?: CarAppearance;
  isGhost?: boolean;
}

export function CarModel({ appearance, isGhost = false }: CarModelProps) {
  const defaultAppearance: CarAppearance = {
    bodyStyle: 'speedster',
    primaryColor: '#00e5ff',
    thrusterColor: '#ff0055'
  };

  const currentAppearance = appearance || defaultAppearance;
  
  const opacity = isGhost ? 0.3 : 1.0;
  const transparent = isGhost;
  
  // Materials
  const primaryMaterial = <meshStandardMaterial color={currentAppearance.primaryColor} roughness={0.2} metalness={0.9} transparent={transparent} opacity={opacity} />;
  const secondaryMaterial = <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={1} transparent={transparent} opacity={opacity} />;
  const glassMaterial = <meshStandardMaterial color="#ffffff" roughness={0.0} metalness={0.8} transparent={true} opacity={isGhost ? 0.2 : 0.6} />;
  const engineMaterial = <meshBasicMaterial color={currentAppearance.thrusterColor} transparent={transparent} opacity={opacity} />;

  // Render different body styles
  switch (currentAppearance.bodyStyle) {
    case 'brute':
      return (
        <group>
          {/* Main Body - Wide and thick */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[3.0, 0.8, 4.0]} />
            {primaryMaterial}
          </mesh>
          {/* Armor Plating */}
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[3.2, 0.2, 3.0]} />
            {secondaryMaterial}
          </mesh>
          {/* Cockpit - Slit style */}
          <mesh position={[0, 0.6, -0.5]}>
            <boxGeometry args={[2.0, 0.3, 1.0]} />
            {glassMaterial}
          </mesh>
          {/* Twin Heavy Thrusters */}
          <mesh position={[-0.8, 0, 2.1]}>
            <boxGeometry args={[0.8, 0.5, 0.2]} />
            {engineMaterial}
          </mesh>
          <mesh position={[0.8, 0, 2.1]}>
            <boxGeometry args={[0.8, 0.5, 0.2]} />
            {engineMaterial}
          </mesh>
          {!isGhost && <pointLight color={currentAppearance.thrusterColor} intensity={2} distance={10} position={[0, 0, 2.5]} />}
        </group>
      );
      
    case 'interceptor':
      return (
        <group>
          {/* Main Body - Sharp and angular */}
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <coneGeometry args={[1.5, 5.0, 4]} />
            {primaryMaterial}
          </mesh>
          {/* Wings / Spoiler */}
          <mesh position={[0, 0.2, 1.5]}>
            <boxGeometry args={[3.5, 0.1, 1.0]} />
            {secondaryMaterial}
          </mesh>
          <mesh position={[-1.7, 0.5, 1.5]}>
            <boxGeometry args={[0.1, 0.8, 1.0]} />
            {primaryMaterial}
          </mesh>
          <mesh position={[1.7, 0.5, 1.5]}>
            <boxGeometry args={[0.1, 0.8, 1.0]} />
            {primaryMaterial}
          </mesh>
          {/* Cockpit */}
          <mesh position={[0, 0.4, -0.5]}>
            <boxGeometry args={[1.0, 0.4, 1.5]} />
            {glassMaterial}
          </mesh>
          {/* Single massive thruster */}
          <mesh position={[0, 0, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.6, 0.8, 0.5, 16]} />
            {engineMaterial}
          </mesh>
          {!isGhost && <pointLight color={currentAppearance.thrusterColor} intensity={2.5} distance={15} position={[0, 0, 2.5]} />}
        </group>
      );
      
    case 'speedster':
    default:
      return (
        <group>
          {/* Sci-fi Hover Car Main Body */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[2.2, 0.6, 4.5]} />
            {primaryMaterial}
          </mesh>
          
          {/* Cockpit Canopy */}
          <mesh position={[0, 0.5, -0.5]}>
            <boxGeometry args={[1.6, 0.6, 2.2]} />
            {glassMaterial}
          </mesh>
          
          {/* Neon Thruster Engine */}
          <mesh position={[0, 0, 2.3]}>
            <boxGeometry args={[1.8, 0.3, 0.2]} />
            {engineMaterial}
            {!isGhost && <pointLight color={currentAppearance.thrusterColor} intensity={2} distance={10} />}
          </mesh>
        </group>
      );
  }
}
