import * as THREE from 'three';
import { generateTrackCurve } from './src/utils/trackGenerator';

function validateTrackOrientation() {
    console.log("Generating track data...");
    const trackData = generateTrackCurve({ segmentsPerTrack: 10, generations: 5 });
    
    if (trackData.failureReason) {
        console.error("Track generation failed:", trackData.failureReason);
        return;
    }

    console.log("Generating ExtrudeGeometry...");
    const shape = new THREE.Shape();
    const width = 12;
    const depth = 1;
    
    // ExtrudeGeometry maps Shape X to the vertical vector, and Shape Y to the horizontal vector.
    // To make the track lay flat, Shape X must be depth (thickness) and Shape Y must be width.
    shape.moveTo(-depth / 2, -width / 2);
    shape.lineTo(depth / 2, -width / 2);
    shape.lineTo(depth / 2, width / 2);
    shape.lineTo(-depth / 2, width / 2);
    shape.lineTo(-depth / 2, -width / 2);

    const extrudeSettings = {
      steps: 100,
      bevelEnabled: false, // Turn off bevel to simplify normal analysis
      extrudePath: trackData.curve,
    };

    trackData.curve.computeFrenetFrames = () => trackData.frames;

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.computeVertexNormals();

    const positionAttribute = geometry.attributes.position;
    const indexAttribute = geometry.index;
    
    let upFacingArea = 0;
    let sideFacingArea = 0;

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i += 3) {
        vA.fromBufferAttribute(positionAttribute, i);
        vB.fromBufferAttribute(positionAttribute, i + 1);
        vC.fromBufferAttribute(positionAttribute, i + 2);

        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab);

        const area = cb.length() / 2;
        if (area === 0) continue;

        cb.normalize();

        const ny = Math.abs(cb.y);
        
        if (ny > 0.707) {
            upFacingArea += area;
        } else {
            sideFacingArea += area;
        }
    }

    console.log(`Total Area: ${upFacingArea + sideFacingArea}`);
    console.log(`Up-facing area (Y > 45 deg): ${upFacingArea}`);
    console.log(`Side-facing area (Y < 45 deg): ${sideFacingArea}`);

    const ratio = upFacingArea / Math.max(1, sideFacingArea);
    console.log(`Ratio (Up / Side): ${ratio.toFixed(2)}`);

    if (ratio > 5) {
        console.log("✅ VALIDATION PASSED: The track is flat (road oriented).");
    } else if (ratio < 0.2) {
        console.log("❌ VALIDATION FAILED: The track is a vertical wall (90 degree rotation).");
        process.exit(1);
    } else {
        console.log("⚠️ AMBIGUOUS ORIENTATION: Manual check required. Ratio is close.");
    }
}

validateTrackOrientation();
