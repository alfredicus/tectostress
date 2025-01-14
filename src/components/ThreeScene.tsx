import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

interface ThreeSceneProps {
    width?: number;
    height?: number;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({
    width = 800,
    height = 600
}) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cubeRef = useRef<THREE.Mesh | null>(null);
    const controlsRef = useRef<TrackballControls | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Initialisation de la scène
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Configuration de la caméra
        const camera = new THREE.PerspectiveCamera(
            75,
            width / height,
            0.1,
            1000
        );
        camera.position.z = 5;
        cameraRef.current = camera;

        // Configuration du renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setClearColor('#000000');
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Configuration des contrôles
        const controls = new TrackballControls(camera, renderer.domElement);
        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.dynamicDampingFactor = 0.1; // Amortissement du mouvement
        controls.keys = ['KeyA', 'KeyS', 'KeyD'];
        controlsRef.current = controls;

        // Ajout des lumières
        const lights = [];
        lights[0] = new THREE.DirectionalLight(0xffffff, 3);
        lights[1] = new THREE.DirectionalLight(0xffffff, 3);
        lights[2] = new THREE.DirectionalLight(0xffffff, 3);

        lights[0].position.set(0, 200, 0);
        lights[1].position.set(100, 200, 100);
        lights[2].position.set(- 100, - 200, - 100);

        scene.add(lights[0]);
        scene.add(lights[1]);
        scene.add(lights[2]);

        const geometry = new THREE.SphereGeometry(2, 32, 16);
        const material = new THREE.MeshPhongMaterial( { color: 0xEEEEEE, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true } );
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        cubeRef.current = sphere;
        const lineMaterial = new THREE.LineBasicMaterial( { color: 0x000000, transparent: true, opacity: 1 } );

        scene.add( new THREE.LineSegments( geometry, lineMaterial ) );

        // Animation function
        const animate = () => {
            if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
                return;
            }

            requestAnimationFrame(animate);

            // Mise à jour des contrôles
            controlsRef.current.update();

            // Rendu de la scène
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };

        animate();

        // Cleanup function
        return () => {
            if (mountRef.current && rendererRef.current) {
                mountRef.current.removeChild(rendererRef.current.domElement);
            }
            if (cubeRef.current) {
                geometry.dispose();
                material.dispose();
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            if (controlsRef.current) {
                controlsRef.current.dispose();
            }
        };
    }, [width, height]);

    // Gestionnaire de redimensionnement
    useEffect(() => {
        const handleResize = () => {
            if (!cameraRef.current || !rendererRef.current || !controlsRef.current) return;

            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
            controlsRef.current.handleResize(); // Mise à jour des contrôles lors du redimensionnement
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [width, height]);

    return (
        <div>
            <div ref={mountRef} className="w-full h-full" />
        </div>
    );
};

export default ThreeScene;