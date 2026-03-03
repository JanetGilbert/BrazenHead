import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ThreeScene: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdddddd);

        // Camera
        const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 10000);
        camera.position.set(0, 10, 30);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        mountRef.current.appendChild(renderer.domElement);

        // Lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemisphereLight.position.set(0, 20, 0);
        scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, 20, 10);
        scene.add(directionalLight);

        let faceMesh: THREE.Mesh | undefined;
        let hmmMorphTargetIndex: number | undefined;

        // Model
        const loader = new GLTFLoader();
        loader.load(
            '/src/assets/face/face.gltf',
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(80, 80, 80);
                model.rotation.y = 0;
                model.position.y = -75; // Manually adjust the position

                model.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.morphTargetInfluences) {
                        faceMesh = child;
                        if (faceMesh.morphTargetDictionary) {
                            hmmMorphTargetIndex = faceMesh.morphTargetDictionary['Hmm'];
                            if (hmmMorphTargetIndex !== undefined && faceMesh.morphTargetInfluences) {
                                faceMesh.morphTargetInfluences[hmmMorphTargetIndex] = 1;
                            }
                        }
                    }
                });

                scene.add(model);
            },
            undefined,
            (error) => {
                console.error(error);
            }
        );

        // Animation
        const animate = () => {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize
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

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            if (mountRef.current) {
                mountRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default ThreeScene;
