import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MOUTH_MORPH_NAMES, getBlendShapesForPhoneme } from './visemeMap';

// ── Lerp speed for viseme transitions (higher = snappier) ──
const VISEME_LERP_SPEED = 16;

// ── Idle blink config ──
const BLINK_MIN_INTERVAL = 2.0;   // seconds
const BLINK_MAX_INTERVAL = 6.0;
const BLINK_DURATION = 0.15;      // seconds for one half-blink

export interface ThreeSceneHandle {
  /** Set the target viseme pose from an IPA phoneme string. */
  setPhoneme: (phoneme: string) => void;
}

interface ThreeSceneProps {
  onReady?: (handle: ThreeSceneHandle) => void;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ onReady }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // ── Mutable refs shared between the effect and callbacks ──
  const faceMeshRef = useRef<THREE.Mesh | null>(null);
  const targetPoseRef = useRef<Map<string, number>>(new Map());
  const currentPoseRef = useRef<Map<string, number>>(new Map());

  /**
   * Called by the Inworld service when a new phoneme arrives.
   * Sets the "target" morph-target weights; the render loop lerps toward them.
   */
  const setPhoneme = useCallback((phoneme: string) => {
    const targets = getBlendShapesForPhoneme(phoneme);
    const pose = targetPoseRef.current;

    // Reset all mouth morphs to 0, then apply the new targets
    for (const name of MOUTH_MORPH_NAMES) {
      pose.set(name, 0);
    }
    for (const { morphName, weight } of targets) {
      pose.set(morphName, weight);
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      10000,
    );
    camera.position.set(0, 10, 30);

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // ── Lighting ──
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemisphereLight.position.set(0, 20, 0);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, 20, 10);
    scene.add(directionalLight);

    // ── Load model ──
    const loader = new GLTFLoader();
    loader.load(
      '/assets/face/face.gltf',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(80, 80, 80);
        model.rotation.y = 0;
        model.position.y = -75; // Manually adjust (pivot far below visual centre)

        model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.morphTargetInfluences) {
            faceMeshRef.current = child;
          }
        });

        scene.add(model);

        // Notify parent that the scene is ready
        onReady?.({ setPhoneme });
      },
      undefined,
      (error) => console.error('GLTF load error:', error),
    );

    // ── Clock & blink state ──
    const clock = new THREE.Clock();
    let nextBlinkTime = BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
    let blinkProgress = -1; // -1 = not blinking; 0→1 = closing; 1→2 = opening

    // ── Animation loop ──
    let animFrameId: number;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const mesh = faceMeshRef.current;

      if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;

        // ── Lerp mouth morph targets toward target pose ──
        for (const name of MOUTH_MORPH_NAMES) {
          const idx = dict[name];
          if (idx === undefined) continue;
          const target = targetPoseRef.current.get(name) ?? 0;
          const current = currentPoseRef.current.get(name) ?? 0;
          const next = THREE.MathUtils.lerp(current, target, 1 - Math.exp(-VISEME_LERP_SPEED * delta));
          currentPoseRef.current.set(name, next);
          influences[idx] = next;
        }

        // ── Idle blink ──
        if (blinkProgress < 0 && elapsed >= nextBlinkTime) {
          blinkProgress = 0;
        }
        if (blinkProgress >= 0) {
          blinkProgress += delta / BLINK_DURATION;
          // 0→1 closing, 1→2 opening
          const blinkWeight = blinkProgress <= 1
            ? blinkProgress
            : Math.max(0, 2 - blinkProgress);

          const blinkIdx = dict['Blink'];
          if (blinkIdx !== undefined) {
            influences[blinkIdx] = blinkWeight;
          }

          if (blinkProgress >= 2) {
            blinkProgress = -1;
            nextBlinkTime = elapsed + BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
            if (blinkIdx !== undefined) influences[blinkIdx] = 0;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ──
    const handleResize = () => {
      if (mountRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };
    window.addEventListener('resize', handleResize);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onReady, setPhoneme]);

  return <div ref={mountRef} className="three-canvas" />;
};

export default ThreeScene;
