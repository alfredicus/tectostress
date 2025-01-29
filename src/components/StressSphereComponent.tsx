import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { StressSphere } from './views/Sphere';
import { X, Plus } from 'lucide-react';
import { DataFiles } from './DataFile';
import { toFloat } from '@alfredo-taboada/stress';


const StressSphereComponent: React.FC<{ files: DataFiles }> = ({ files }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [stressSphere, setStressSphere] = useState<StressSphere | null>(null);
    const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
    const [scene, setScene] = useState<THREE.Scene | null>(null);
    const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);
    const [controls, setControls] = useState<OrbitControls | null>(null);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [displayedFiles, setDisplayedFiles] = useState<Set<string>>(new Set());

    // console.log(files)
    const datas = files.map(d => d.content.map(lines => lines.map(line => line.replace(/\s+/g, " ").split(' ').map(s => toFloat(s)))))

    useEffect(() => {
        if (!containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const newRenderer = new THREE.WebGLRenderer({ antialias: true });
        newRenderer.setSize(width, height);
        containerRef.current.appendChild(newRenderer.domElement);

        const newScene = new THREE.Scene();
        newScene.background = new THREE.Color(0xf0f0f0);

        const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.001, 1000);
        newCamera.position.z = 5;

        const ambientLight = new THREE.AmbientLight(0xffffff);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        newScene.add(ambientLight);
        newScene.add(directionalLight);

        const newControls = new OrbitControls(newCamera, newRenderer.domElement);
        newControls.enableDamping = true;

        const newStressSphere = new StressSphere(1);
        newScene.add(newStressSphere.getObject());

        newStressSphere.updateStressState(1, 0, -1);

        setRenderer(newRenderer);
        setScene(newScene);
        setCamera(newCamera);
        setControls(newControls);
        setStressSphere(newStressSphere);

        const animate = () => {
            requestAnimationFrame(animate);
            newControls.update();
            newRenderer.render(newScene, newCamera);
        };
        animate();

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                newRenderer.setSize(width, height);
                newCamera.aspect = width / height;
                newCamera.updateProjectionMatrix();
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            containerRef.current?.removeChild(newRenderer.domElement);
            newRenderer.dispose();
        };
    }, []);

    const addFileToSphere = () => {
        if (!stressSphere || !selectedFile) return;

        const file = files?.find(f => f.id === selectedFile);
        if (!file) return;

        // =============================== HERE =================================
        // Assuming file content contains coordinates in the format [x, y, z]
        const normals = file.content.map(row => row.slice(0, 3).map(Number));

        // Filter out any invalid numbers
        const validNormals = normals.filter(coords =>
            coords.length === 3 && coords.every(n => !isNaN(n))
        );

        if (validNormals.length > 0) {
            stressSphere.addPolyline({
                positions: validNormals.map(n => ({
                    normal: new THREE.Vector3(n[0], n[1], n[2])
                })),
                offset: 0.1,
                color: Math.random() * 0xffffff, // Random color for each line
                lineWidth: 0.01
            });

            setDisplayedFiles(prev => new Set(prev).add(selectedFile));
        }
        // =============================== HERE =================================
    };

    const removeFileFromSphere = (fileId: string) => {
        if (!stressSphere) return;

        // Note: You'll need to implement removePolyline in your StressSphere class
        // stressSphere.removePolyline(fileId);

        setDisplayedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
        });
    };

    return (
        <div className="h-full flex gap-4">
            <div className="flex-1 min-h-0">
                <div ref={containerRef} className="w-full h-full border rounded-lg" />
            </div>

            {/* Control Panel */}
            <div className="w-64 bg-gray-100 p-4 rounded-lg shadow">
                <h3 className="font-semibold mb-4">Sphere Controls</h3>

                {/* File Selection */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Select File</label>
                        <select
                            value={selectedFile}
                            onChange={(e) => setSelectedFile(e.target.value)}
                            className="w-full p-2 border rounded bg-white"
                        >
                            <option value="">Choose a file...</option>
                            {files?.map(file => (
                                <option key={file.id} value={file.id}>
                                    {file.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={addFileToSphere}
                        disabled={!selectedFile}
                        className="flex items-center gap-2 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        <Plus size={16} />
                        Add to Sphere
                    </button>

                    {/* Displayed Files List */}
                    <div>
                        <h4 className="font-medium mb-2">Displayed Files</h4>
                        <div className="space-y-2">
                            {Array.from(displayedFiles).map(fileId => {
                                const file = files?.find(f => f.id === fileId);
                                if (!file) return null;

                                return (
                                    <div key={fileId} className="flex items-center justify-between bg-white p-2 rounded">
                                        <span className="text-sm truncate">{file.name}</span>
                                        <button
                                            onClick={() => removeFileFromSphere(fileId)}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StressSphereComponent;
