// SphereComponent.tsx
// 3-D stress sphere for the inversion results, built on the `slip-lines` computation module
// (sphere_utils.ts — Taboada, A., 1993, "Stress and strain from striated pebbles"):
// theoretical slip lines, normal-stress equipotentials and the principal axes of the inverted
// tensor, with the measured and predicted striations drawn on the sphere surface.
//
// Frames
// ──────
// sphere_utils works in the principal frame with (lambda_x, lambda_y, lambda_z) = (σ1, σ3, σ2),
// values ordered algebraically σ1 < σ2 < σ3. A geographic vector v = (E, N, Up) becomes
//     v_frame = ( v·e1 , v·e3 , v·e2 )
// with e1/e2/e3 the eigenvectors of the solution, e1 the most compressive axis — the same
// mapping the Mohr diagram uses.
//
// Three.js display uses the slip-lines convention (X, Y, Z) = (frame.y, frame.z, frame.x),
// i.e. σ3 to the right, σ2 up, σ1 towards the viewer.
//
// Both reference frames are drawn: the principal axes (solid, coloured, σ₁/σ₂/σ₃) and the
// geographic triad (dashed, N/S — E/W — Up/Down) obtained by pushing (1,0,0), (0,1,0), (0,0,1)
// through the same mapping, which is what shows how the tensor sits relative to the ground.
//
// A striation is tangent to the sphere at the pole of its plane, so it is drawn as a short
// great-circle arc from that pole — directly comparable with the slip lines it should follow.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Layers } from 'lucide-react';
import {
    FaultDataHelper, Direction, CDirection, TypeOfMovement, CTypeOfMovement
} from '@alfredo-taboada/stress';
import {
    generateSlipLines,
    generateEquipotentialsParametric,
    generateEquipotentialsBinary,
    generateSpecialEquipotentialMeridian,
    generatePrincipalAxes,
    getEquipotentialPoint,
    getMohrPoint,
    EquipotentialCurve,
    SlipLineCurve,
    PrincipalAxis,
    Point3D
} from './sphere_utils';
import {
    BufferGeometry as KBufferGeometry,
    Float32BufferAttribute as KFloat32BufferAttribute,
    Uint32BufferAttribute as KUint32BufferAttribute
} from './keplerlit/attributes';
import { colorMapNames, createLut } from './keplerlit/colorMap';
import { createIsoContoursFilled } from './keplerlit/IsoContoursFilled';
import { createIsoContourLines } from './keplerlit/IsoContoursLines';
import StablePlotWithSettings from '../PlotWithSettings';
import { useSettings } from '../Settings/SettingsContext';
import {
    BaseVisualizationProps,
    useVisualizationState
} from '../VisualizationStateSystem';
import { beautifyName, TypeSynonyms } from '@/utils';
import {
    SphereCompState,
    SphereSettings,
    createSphereSettings,
    SPHERE_DATA_TYPES,
    SPHERE_TYPE_COLORS,
    SPHERE_TYPE_LABELS,
    SPHERE_FALLBACK_COLORS
} from './SphereParameters';

// The slip-line geometry depends only on the stress ratio R, so the principal values are fed on
// the same arbitrary scale the slip-lines app uses; only R comes from the inversion.
const S1_REF = 1.0;
const S3_REF = 3.0;
const computeS2 = (S1: number, S3: number, R: number): number => S3 + R * (S1 - S3);

const CURVE_RESOLUTION = 200;
const SURFACE_OFFSET = 1.004;   // striations sit just above the curves (1.001)

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

/** Map a numeric azimuth (degrees clockwise from N) to the nearest compass Direction enum. */
function azimuthToDirection(az: number): Direction {
    const a = ((az % 360) + 360) % 360;
    if (a <= 22.5 || a > 337.5) return Direction.N;
    if (a <= 67.5)  return Direction.NE;
    if (a <= 112.5) return Direction.E;
    if (a <= 157.5) return Direction.SE;
    if (a <= 202.5) return Direction.S;
    if (a <= 247.5) return Direction.SW;
    if (a <= 292.5) return Direction.W;
    return Direction.NW;
}

/** Parse dip Direction from a row field, falling back to deriving it from strike. */
function parseDipDirection(row: any, strike: number): Direction {
    const dd = row['dip direction'];
    if (dd && CDirection.exists(String(dd))) {
        return CDirection.fromString(String(dd));
    }
    return azimuthToDirection((strike + 90) % 360);
}

/** Trend/plunge (degrees) to a geographic unit vector (E, N, Up). */
function trendPlungeToVector(trend: number, plunge: number): number[] {
    const t = trend * Math.PI / 180;
    const p = plunge * Math.PI / 180;
    return [Math.cos(p) * Math.sin(t), Math.cos(p) * Math.cos(t), -Math.sin(p)];
}

/**
 * Plane normal for a data row, in the geographic frame (E, N, Up).
 * Accepts either trend/plunge (already a pole) or strike/dip[/dip direction].
 */
function normalFromRow(row: any): number[] | null {
    const trend = parseFloat(row.trend);
    const plunge = parseFloat(row.plunge);
    if (!isNaN(trend) && !isNaN(plunge)) {
        return trendPlungeToVector(trend, plunge);
    }

    const strike = parseFloat(row.strike);
    const dip = parseFloat(row.dip);
    if (!isNaN(strike) && !isNaN(dip)) {
        try {
            const helper = new FaultDataHelper({ strike, dipDirection: parseDipDirection(row, strike), dip });
            return helper.normal as number[];
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Striation from strike/dip/rake using pure geometry (no movement validation).
 * Fallback for when FaultDataHelper.create() rejects the type of movement — same approach as
 * the Wulff stereonet.
 */
function striationFromRakeGeometry(normal: number[], rake: number): number[] {
    const phi = Math.atan2(normal[0], normal[1]);             // azimuth of the dip direction
    const ep = [-Math.sin(phi), Math.cos(phi), 0];            // along strike
    const et = [                                              // down dip = normal × e_phi
        normal[1] * ep[2] - normal[2] * ep[1],
        normal[2] * ep[0] - normal[0] * ep[2],
        normal[0] * ep[1] - normal[1] * ep[0],
    ];
    const r = (rake * Math.PI) / 180;
    return [
        Math.cos(r) * ep[0] + Math.sin(r) * et[0],
        Math.cos(r) * ep[1] + Math.sin(r) * et[1],
        Math.cos(r) * ep[2] + Math.sin(r) * et[2],
    ];
}

/** Measured striation for a row, in the geographic frame, or null when the row has no rake. */
function striationFromRow(row: any, normal: number[]): number[] | null {
    const strike = parseFloat(row.strike);
    const dip = parseFloat(row.dip);
    const rake = parseFloat(row.rake);
    if (isNaN(strike) || isNaN(dip) || isNaN(rake)) return null;

    const dipDirection = parseDipDirection(row, strike);
    try {
        const movRaw = row['type of movement'];
        const parsedMov = movRaw ? CTypeOfMovement.fromString(String(movRaw)) : undefined;
        const typeOfMovement = CTypeOfMovement.isOk(parsedMov) ? parsedMov : TypeOfMovement.UND;
        const sdRaw = row['strike direction'];
        const strikeDirection = sdRaw && CDirection.exists(String(sdRaw))
            ? CDirection.fromString(String(sdRaw))
            : Direction.UND;

        const helper = FaultDataHelper.create(
            { strike, dipDirection, dip },
            { trendIsDefined: false, rake, strikeDirection, typeOfMovement, trend: 0 }
        );
        return helper.striation as number[];
    } catch {
        return striationFromRakeGeometry(normal, rake);
    }
}

/** Canonical group a raw type string belongs to, or its own beautified name. */
function groupOf(raw: unknown): string {
    const t = String(raw ?? '').trim();
    if (!t) return 'unknown';
    for (const canonical of SPHERE_DATA_TYPES) {
        try {
            if (TypeSynonyms.isSameType(canonical, t)) return canonical;
        } catch {
            // Canonical type missing from the synonym table — try the next one.
        }
    }
    return beautifyName(t) || 'unknown';
}

function dot3(a: number[], b: number[]): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: number[], b: number[]): number[] {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

/**
 * Principal frame of the solution, read from what RunComponent attaches to the files:
 * the σ1/σ2/σ3 directions on each file, and the matching eigenvalues in the synthetic
 * "Stress Inversion Results" file. Eigen pairs are sorted by |value| descending so e1 is the most
 * compressive axis whichever sign convention the library used — same logic as the Mohr diagram.
 *
 * The eigenvectors come out of `math.eigs` with arbitrary signs, so the basis the sphere projects
 * onto — (e1, e3, e2), the library's principal-frame order — is right-handed only by luck. A
 * left-handed one mirrors the whole picture (East and West swap, striation senses reverse), so one
 * axis is flipped here when needed. A principal axis has no sense of direction, so this is free.
 */
function readStressFrame(files: any[]): { e1: number[]; e2: number[]; e3: number[]; R: number } | null {
    if (!files || files.length === 0) return null;

    const axes = files.find(f => f?.stressAxes)?.stressAxes;
    if (!axes?.sigma1 || !axes?.sigma2 || !axes?.sigma3) return null;

    const paramOf = (name: string): number | undefined => {
        for (const f of files) {
            const rows = f?.content || f?.data;
            if (!Array.isArray(rows)) continue;
            const hit = rows.find((r: any) => r?.parameter === name);
            if (hit && typeof hit.value === 'number') return hit.value;
        }
        return undefined;
    };

    const v1 = paramOf('sigma1');
    const v2 = paramOf('sigma2');
    const v3 = paramOf('sigma3');
    if (v1 === undefined || v2 === undefined || v3 === undefined) return null;

    const sorted = [
        { value: v1, vec: axes.sigma1 as number[] },
        { value: v2, vec: axes.sigma2 as number[] },
        { value: v3, vec: axes.sigma3 as number[] },
    ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const range = sorted[0].value - sorted[2].value;
    if (Math.abs(range) < 1e-10) return null;   // degenerate / isotropic

    const e1 = sorted[0].vec;
    let e2 = sorted[1].vec;
    const e3 = sorted[2].vec;

    // (e1, e3, e2) must satisfy e1 × e3 = e2 for the projection to be a rotation.
    if (dot3(cross3(e1, e3), e2) < 0) {
        e2 = e2.map(c => -c);
    }

    return {
        e1,
        e2,
        e3,
        R: (sorted[1].value - sorted[2].value) / range,
    };
}

/** '#rrggbb' → 0xrrggbb for three.js. */
function hexToInt(color: string): number {
    return parseInt(color.replace('#', ''), 16);
}

// ============================================================================
// MOHR PANEL
// ============================================================================

/**
 * What the sphere hands to the Mohr diagram beside it — the projection of fig. 8b in
 * Taboada (1993): the same equipotentials (vertical lines, Fn being constant along them), the
 * same integral curves, and one point per measured plane.
 */
interface MohrData {
    /** (σ1, σ2, σ3) on the sphere's own arbitrary scale, normalised for display. */
    sigmaRef: [number, number, number];
    isoLines: Array<{ sigma: number; tauMin: number; tauMax: number }>;
    slipCurves: Array<Array<[number, number]>>;
    points: Array<{ sigma: number; tau: number; color: string; label: string }>;
}

/** Layout of the Mohr SVG, in its own user units (aspect kept, the panel scales it). */
const MOHR_SCALE = 520;      // px for the whole normalised σn range (|σ1 − σ3| = 1)
const MOHR_MARGIN = { left: 40, right: 48, top: 22, bottom: 30 };

// ============================================================================
// STRESS SPHERE COMPONENT
// ============================================================================

const SphereComponent: React.FC<BaseVisualizationProps<SphereCompState> & { autoEnable?: boolean }> = ({
    files,
    width = 600,
    height = 600,
    title = "Stress Sphere",
    state,
    onStateChange,
    autoEnable = false
}) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const contentRef = useRef<THREE.Group | null>(null);
    const surfaceRef = useRef<THREE.Mesh | null>(null);
    const sphereGeometryRef = useRef<THREE.SphereGeometry | null>(null);
    const [showDataPanel, setShowDataPanel] = useState(false);
    const [stats, setStats] = useState<{ total: number; poles: number; measured: number; predicted: number } | null>(null);
    /** σn range of the coloured field, for the legend. */
    const [fieldRange, setFieldRange] = useState<{ min: number; max: number } | null>(null);
    /** Curves and points of the companion Mohr diagram, filled while the sphere is built. */
    const [mohr, setMohr] = useState<MohrData | null>(null);
    // Several spheres can share a page, so the region clip-path needs an id of its own.
    // useId's colons are legal in an id but awkward inside url(...), hence the scrub.
    const mohrClipId = React.useId().replace(/[^a-zA-Z0-9_-]/g, '-');
    // Application-wide principal-stress convention (geologist / engineer), as used by the
    // inversion's Mohr diagram — it decides which end of the σn axis σ1 sits at.
    const { settings: appSettings } = useSettings();
    const isEngineer = appSettings.stressConvention === 'engineer';
    // Guards the one-shot auto-enabling of the predicted overlay (see effect below).
    const predictedAutoEnabled = useRef(false);

    const {
        state: currentState,
        updateSettings,
        updatePlotDimensions,
        toggleSettingsPanel
    } = useVisualizationState<SphereCompState>(
        'sphere',
        // In the inversion results panel (autoEnable) the predicted striations are shown straight
        // away; elsewhere the overlay stays opt-in.
        createSphereSettings({ showPredictedStriations: autoEnable }),
        files,
        width,
        height,
        state,
        onStateChange
    );

    // Defaults underneath, so a state saved before a setting existed still gets a value for it.
    // Memoised: the content effect keys on this object's identity.
    const settings = useMemo(
        () => ({
            ...createSphereSettings({ showPredictedStriations: autoEnable }),
            ...currentState.settings
        }),
        [currentState.settings, autoEnable]
    );

    // Sync dimensions from props - only update if actually changed
    useEffect(() => {
        if (width > 0 && height > 0) {
            const { width: w, height: h } = currentState.plotDimensions;
            if (w !== width || h !== height) {
                updatePlotDimensions({ width, height });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [width, height]);

    // ── Data types present, with counts ──────────────────────────────────────
    const groups = useMemo(() => {
        const counts = new Map<string, number>();
        (files as any[] || []).forEach(file => {
            const rows = file?.content || file?.data;
            if (!Array.isArray(rows)) return;
            rows.forEach((row: any) => {
                if (row?.type == null || !normalFromRow(row)) return;
                const g = groupOf(row.type);
                counts.set(g, (counts.get(g) ?? 0) + 1);
            });
        });
        return Array.from(counts, ([key, count]) => ({ key, count }));
    }, [files]);

    const colorFor = (key: string): string => {
        if (settings.typeColors[key]) return settings.typeColors[key];
        if (SPHERE_TYPE_COLORS[key]) return SPHERE_TYPE_COLORS[key];
        const idx = groups.findIndex(g => g.key === key);
        return SPHERE_FALLBACK_COLORS[(idx < 0 ? 0 : idx) % SPHERE_FALLBACK_COLORS.length];
    };
    const labelFor = (key: string): string => SPHERE_TYPE_LABELS[key] ?? beautifyName(key);

    const stressFrame = useMemo(() => readStressFrame(files as any[]), [files]);

    // Keep the selected-file list in step with what is loaded, and reveal the predicted
    // striations as soon as an inversion attaches them (once, so unticking sticks).
    useEffect(() => {
        if (!files || files.length === 0) return;

        const fileIds = files.map((f: any) => f.id);
        const filesChanged = JSON.stringify(fileIds) !== JSON.stringify(settings.selectedFiles);

        const hasPredictions = (files as any[]).some(f => {
            const rows = f?.content || f?.data;
            return Array.isArray(rows) && rows.some((r: any) => r?.predicted_striation);
        });
        const enablePredicted = hasPredictions && !predictedAutoEnabled.current;
        predictedAutoEnabled.current = hasPredictions;

        if (filesChanged || enablePredicted) {
            updateSettings({
                ...(filesChanged ? { selectedFiles: fileIds } : {}),
                ...(enablePredicted ? { showPredictedStriations: true } : {})
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files]);

    // ── Scene setup (once) ───────────────────────────────────────────────────
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const w = Math.max(mount.clientWidth, 100);
        const h = Math.max(mount.clientHeight, 100);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
        camera.position.set(3, 2.4, 3);

        scene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const light1 = new THREE.DirectionalLight(0xffffff, 0.8);
        light1.position.set(5, 5, 5);
        const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
        light2.position.set(-5, -5, -5);
        scene.add(light1, light2);

        // Opaque sphere just under the curves so only the near side is visible. It is hidden when
        // the normal-stress field is drawn, which supplies its own coloured surface.
        const sphereGeometry = new THREE.SphereGeometry(1, 96, 64);
        const surface = new THREE.Mesh(
            sphereGeometry,
            new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 8 })
        );
        scene.add(surface);
        surfaceRef.current = surface;
        sphereGeometryRef.current = sphereGeometry;

        const content = new THREE.Group();
        scene.add(content);
        contentRef.current = content;

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.target.set(0, 0, 0);

        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        controlsRef.current = controls;

        let frame = 0;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const cw = Math.max(entry.contentRect.width, 100);
                const ch = Math.max(entry.contentRect.height, 100);
                renderer.setSize(cw, ch);
                camera.aspect = cw / ch;
                camera.updateProjectionMatrix();
                // Fat lines are screen-space: their material needs the pixel resolution.
                content.traverse(obj => {
                    const mat = (obj as any).material;
                    if (mat && mat.isLineMaterial) mat.resolution.set(cw, ch);
                });
            }
        });
        resizeObserver.observe(mount);

        return () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            controls.dispose();
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) {
                mount.removeChild(renderer.domElement);
            }
            rendererRef.current = null;
            sceneRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            contentRef.current = null;
            surfaceRef.current = null;
            sphereGeometryRef.current = null;
        };
    }, []);

    // ── Cheap settings that do not need a rebuild ────────────────────────────
    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = settings.autoRotate;
            controlsRef.current.autoRotateSpeed = 1.5;
        }
        if (sceneRef.current) {
            sceneRef.current.background = new THREE.Color(settings.backgroundColor);
        }
        const mat = surfaceRef.current?.material as THREE.MeshPhongMaterial | undefined;
        if (mat) mat.color.set(settings.sphereColor);
    }, [settings.autoRotate, settings.backgroundColor, settings.sphereColor]);

    // ── Sphere content ───────────────────────────────────────────────────────
    //
    // Rebuilt whenever the data or the display settings change. Cheaper than mutating the scene
    // graph piecemeal, and it cannot leave stale curves or striations behind.
    useEffect(() => {
        const content = contentRef.current;
        const renderer = rendererRef.current;
        if (!content || !renderer) return;

        // Dispose what we are about to drop — fat lines allocate GPU buffers per curve.
        content.traverse(obj => {
            const any = obj as any;
            any.geometry?.dispose?.();
            const materials = Array.isArray(any.material) ? any.material : [any.material];
            materials.forEach((m: any) => {
                m?.map?.dispose?.();   // label sprites own a canvas texture
                m?.dispose?.();
            });
        });
        content.clear();

        if (!stressFrame) {
            setStats(null);
            setFieldRange(null);
            setMohr(null);
            if (surfaceRef.current) surfaceRef.current.visible = true;
            return;
        }

        const pixelW = renderer.domElement.clientWidth;
        const pixelH = renderer.domElement.clientHeight;

        /** Frame coordinates → three.js display coordinates, as in the slip-lines app. */
        const toDisplay = (v: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(v.y, v.z, v.x);

        /** Geographic (E, N, Up) → principal frame (σ1, σ3, σ2), the frame sphere_utils works in. */
        const { e1, e2, e3, R } = stressFrame;
        const toFrame = (n: number[]): Point3D => ({ x: dot3(n, e1), y: dot3(n, e3), z: dot3(n, e2) });

        /** …and on to display coordinates. */
        const toSphere = (n: number[]): THREE.Vector3 => {
            const f = toFrame(n);
            return toDisplay(new THREE.Vector3(f.x, f.y, f.z)).normalize();
        };

        const addFatLine = (points: THREE.Vector3[], color: string, lineWidth: number) => {
            if (points.length < 2) return;
            const positions: number[] = [];
            points.forEach(p => positions.push(p.x, p.y, p.z));
            const geometry = new LineGeometry().setPositions(positions);
            const material = new LineMaterial({
                color: new THREE.Color(color),
                linewidth: lineWidth,
                resolution: new THREE.Vector2(pixelW, pixelH)
            });
            content.add(new LineSegments2(geometry, material));
        };

        /**
         * Camera-facing text sprite — axis names and data numbers.
         *
         * Depth-tested, so a label whose anchor is behind the sphere is hidden by it: an axis
         * pointing away from the viewer must not read as one pointing towards them. The canvas is
         * cut to the text so the glyphs keep their aspect ratio whatever the label's length.
         */
        const addLabel = (position: THREE.Vector3, text: string, color: string, height = 0.18) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const fontSize = 64;
            const font = `bold ${fontSize}px sans-serif`;
            ctx.font = font;
            canvas.width = Math.ceil(ctx.measureText(text).width) + 20;
            canvas.height = Math.round(fontSize * 1.5);

            // Re-applied: resizing the canvas resets the context.
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Halo, so a dark label stays readable over the coloured field.
            ctx.lineWidth = 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = color;
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);

            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: new THREE.CanvasTexture(canvas),
                transparent: true,
                depthWrite: false
            }));
            sprite.position.copy(position);
            sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
            content.add(sprite);
        };

        /** Curves from sphere_utils come as parallel x/y/z arrays in frame coordinates. */
        const addCurves = (curves: Array<SlipLineCurve | EquipotentialCurve>, color: string, lineWidth: number) => {
            curves.forEach(curve => {
                const { x, y, z } = curve as any;
                if (!x?.length || x.length !== y.length || y.length !== z.length) return;
                const pts: THREE.Vector3[] = [];
                for (let i = 0; i < x.length; i++) {
                    if (!isFinite(x[i]) || !isFinite(y[i]) || !isFinite(z[i])) return;
                    pts.push(new THREE.Vector3(y[i] * 1.001, z[i] * 1.001, x[i] * 1.001));
                }
                addFatLine(pts, color, lineWidth);
            });
        };

        const S2 = computeS2(S1_REF, S3_REF, R);
        const config = {
            nCurves: settings.nCurves,
            nIsoCurves: settings.nIsoCurves,
            curveResolution: CURVE_RESOLUTION
        };

        // ── Normal-stress field: filled iso-contour bands on the surface ─────
        //
        // σn is sampled at every vertex of the sphere mesh and banded by keplerlit's marching
        // triangles. The mesh lives in display coordinates (X, Y, Z) = (σ3, σ2, σ1), so the
        // principal values are passed in that same order — otherwise the bands would not line up
        // with the analytic equipotential curves.
        const sphereGeometry = sphereGeometryRef.current;
        if (settings.showNormalStressField && sphereGeometry) {
            const position = sphereGeometry.attributes.position;
            const scalarField: number[] = [];
            for (let i = 0; i < position.count; i++) {
                scalarField.push(getEquipotentialPoint(
                    { x: position.getX(i), y: position.getY(i), z: position.getZ(i) },
                    S3_REF, S2, S1_REF
                ));
            }

            const minVal = Math.min(...scalarField);
            const maxVal = Math.max(...scalarField);
            const nBands = settings.nIsoCurves + 1;
            const isoList = Array.from({ length: nBands }, (_, i) =>
                minVal + (i / (nBands - 1)) * (maxVal - minVal));

            const indices = sphereGeometry.index
                ? Array.from(sphereGeometry.index.array)
                : Array.from({ length: position.count }, (_, i) => i);

            const keplerGeometry = new KBufferGeometry();
            keplerGeometry.setPositions(new KFloat32BufferAttribute(Array.from(position.array), 3));
            keplerGeometry.setIndices(new KUint32BufferAttribute(indices, 1));

            const filled = createIsoContoursFilled(keplerGeometry, scalarField, isoList, {
                min: minVal,
                max: maxVal,
                lut: settings.colorTableName,
                nbColors: 128
            });

            if (filled) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(filled.position, 3));
                geometry.setIndex(new THREE.Uint32BufferAttribute(filled.index, 1));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(filled.color), 3));
                geometry.computeVertexNormals();
                content.add(new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
                    vertexColors: true,
                    side: THREE.DoubleSide,
                    flatShading: false,
                    polygonOffset: true,
                    polygonOffsetFactor: 0.5
                })));
            }

            if (settings.showNormalStressIsoLines) {
                const isoLines = createIsoContourLines(keplerGeometry, scalarField, isoList, '#000000', settings.colorTableName);
                if (isoLines.positions.length > 0) {
                    // Nudge the lines outwards so they are not swallowed by the banded surface.
                    const pts = new Float32Array(isoLines.positions.length);
                    for (let i = 0; i < isoLines.positions.length; i += 3) {
                        const v = new THREE.Vector3(
                            isoLines.positions[i], isoLines.positions[i + 1], isoLines.positions[i + 2]
                        ).normalize().multiplyScalar(1.0015);
                        pts[i] = v.x; pts[i + 1] = v.y; pts[i + 2] = v.z;
                    }
                    const lineGeometry = new THREE.BufferGeometry();
                    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
                    content.add(new THREE.LineSegments(
                        lineGeometry, new THREE.LineBasicMaterial({ color: 0x000000 })
                    ));
                }
            }

            setFieldRange({ min: minVal, max: maxVal });
            if (surfaceRef.current) surfaceRef.current.visible = false;
        } else {
            setFieldRange(null);
            if (surfaceRef.current) surfaceRef.current.visible = true;
        }

        // ── Slip lines, equipotentials and principal axes ────────────────────
        //
        // The same curves are projected into the Mohr diagram as they are built (Taboada 1993,
        // fig. 8b), rather than regenerated for the side panel: generating them is the expensive
        // part, and this way the two views cannot disagree.
        const mohrIso: MohrData['isoLines'] = [];
        const mohrSlip: MohrData['slipCurves'] = [];
        const mohrPoints: MohrData['points'] = [];

        /** Frame point → (Fn, Fτ), with the λ order the curve generators were given. */
        const toMohr = (p: Point3D) => getMohrPoint(p, S1_REF, S3_REF, S2);

        if (settings.showEquipotential) {
            const equipotentials = settings.useParametricEquipotentials
                ? generateEquipotentialsParametric(S1_REF, S3_REF, S2, config)
                : generateEquipotentialsBinary(S1_REF, S3_REF, S2, config);
            addCurves(equipotentials, settings.equipotentialColor, settings.curveLineWidth);

            // Fn is constant along an equipotential, so each one collapses to a vertical segment;
            // only its τ extent has to be carried over. Curves reflected into the other octants
            // land on the same segment, hence the dedup.
            const seen = new Set<string>();
            equipotentials.forEach(curve => {
                let sigma = NaN;
                let tauMin = Infinity;
                let tauMax = -Infinity;
                for (let i = 0; i < curve.x.length; i++) {
                    const { sigma_n, tau } = toMohr({ x: curve.x[i], y: curve.y[i], z: curve.z[i] });
                    if (!isFinite(sigma_n) || !isFinite(tau)) continue;
                    sigma = sigma_n;
                    if (tau < tauMin) tauMin = tau;
                    if (tau > tauMax) tauMax = tau;
                }
                if (!isFinite(sigma) || tauMax <= tauMin) return;
                const key = `${sigma.toFixed(4)}|${tauMin.toFixed(4)}|${tauMax.toFixed(4)}`;
                if (seen.has(key)) return;
                seen.add(key);
                mohrIso.push({ sigma, tauMin, tauMax });
            });
        }

        if (settings.showSpecialEquipotential) {
            const meridians = generateSpecialEquipotentialMeridian(S1_REF, S3_REF, S2, { curveResolution: 500 });
            addCurves(meridians, settings.specialEquipotentialColor, settings.curveLineWidth);
        }

        if (settings.showSlipLines) {
            const slipLines = generateSlipLines(S1_REF, S3_REF, S2, config);
            addCurves(slipLines, settings.slipLineColor, settings.curveLineWidth);

            slipLines.forEach(curve => {
                const pts: Array<[number, number]> = [];
                for (let i = 0; i < curve.x.length; i++) {
                    const { sigma_n, tau } = toMohr({ x: curve.x[i], y: curve.y[i], z: curve.z[i] });
                    if (isFinite(sigma_n) && isFinite(tau)) pts.push([sigma_n, tau]);
                }
                if (pts.length > 1) mohrSlip.push(pts);
            });
        }

        if (settings.showStressAxes) {
            const axes: PrincipalAxis[] = generatePrincipalAxes(S1_REF, S3_REF, S2);
            axes.forEach(axis => {
                const dir = toDisplay(new THREE.Vector3(axis.axis.x, axis.axis.y, axis.axis.z));
                const material = new THREE.LineBasicMaterial({ color: axis.colorHex });
                // The frame axes are (x, y, z) = (σ1, σ3, σ2). A principal axis has no sense of
                // direction, so both of its ends carry the same name.
                const name = axis.axis.x ? 'σ₁' : axis.axis.y ? 'σ₃' : 'σ₂';
                const color = `#${axis.colorHex.toString(16).padStart(6, '0')}`;
                [1, -1].forEach(sign => {
                    const end = dir.clone().multiplyScalar(1.45 * sign);
                    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]);
                    content.add(new THREE.Line(geometry, material));
                    const head = new THREE.Mesh(
                        new THREE.ConeGeometry(0.05, 0.16, 16),
                        new THREE.MeshPhongMaterial({ color: axis.colorHex })
                    );
                    head.position.copy(end);
                    head.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        dir.clone().multiplyScalar(sign).normalize()
                    );
                    content.add(head);

                    if (settings.showAxisLabels) {
                        addLabel(dir.clone().multiplyScalar(1.62 * sign), name, color);
                    }
                });
            });
        }

        // ── Geographic reference frame ───────────────────────────────────────
        //
        // The same N/S, E/W, Up/Down triad the data is measured in, rotated into the principal
        // frame of the solution: it shows how the inverted tensor sits with respect to the
        // ground. Dashed, so it reads as a second frame rather than more stress axes.
        if (settings.showGeoAxes) {
            const geoAxes = [
                { vec: [0, 1, 0], positive: 'N',  negative: 'S' },      // geographic (E, N, Up)
                { vec: [1, 0, 0], positive: 'E',  negative: 'W' },
                { vec: [0, 0, 1], positive: 'Up', negative: 'Down' },
            ];
            const material = new THREE.LineDashedMaterial({
                color: hexToInt(settings.geoAxesColor),
                dashSize: 0.07,
                gapSize: 0.05
            });
            geoAxes.forEach(({ vec, positive, negative }) => {
                const dir = toSphere(vec);
                ([[1, positive], [-1, negative]] as Array<[number, string]>).forEach(([sign, text]) => {
                    const end = dir.clone().multiplyScalar(1.3 * sign);
                    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), end]);
                    const line = new THREE.Line(geometry, material);
                    line.computeLineDistances();
                    content.add(line);
                    if (settings.showAxisLabels) {
                        addLabel(end.clone().multiplyScalar(1.09), text, settings.geoAxesColor);
                    }
                });
            });
        }

        // ── Data: poles and striations ───────────────────────────────────────
        let total = 0;
        let poles = 0;
        let measured = 0;
        let predicted = 0;

        /**
         * A striation is tangent to the sphere at the pole of its plane: walk the great circle
         * from the pole along the striation direction, then cap it with a small arrowhead so the
         * sense of movement is readable.
         */
        const addStriation = (pole: THREE.Vector3, dir: THREE.Vector3, color: string) => {
            // Re-orthogonalise against the pole; rounding in the data can leave them slightly off.
            const tangent = dir.clone().sub(pole.clone().multiplyScalar(dir.dot(pole)));
            if (tangent.lengthSq() < 1e-12) return false;
            tangent.normalize();

            const arc = (settings.striationLength * Math.PI) / 180;
            const steps = 12;
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i <= steps; i++) {
                const t = (i / steps) * arc;
                pts.push(
                    pole.clone().multiplyScalar(Math.cos(t))
                        .add(tangent.clone().multiplyScalar(Math.sin(t)))
                        .multiplyScalar(SURFACE_OFFSET)
                );
            }
            addFatLine(pts, color, settings.striationWidth);

            // Arrowhead: two short barbs in the tangent plane at the far end.
            const tip = pts[pts.length - 1];
            const along = tip.clone().sub(pts[pts.length - 2]).normalize();
            const side = new THREE.Vector3().crossVectors(tip.clone().normalize(), along).normalize();
            const barb = arc * 0.35;
            [1, -1].forEach(sign => {
                const end = tip.clone()
                    .add(along.clone().multiplyScalar(-barb))
                    .add(side.clone().multiplyScalar(barb * 0.6 * sign))
                    .normalize()
                    .multiplyScalar(SURFACE_OFFSET);
                addFatLine([tip, end], color, settings.striationWidth);
            });
            return true;
        };

        (files as any[]).forEach(file => {
            if (settings.selectedFiles.length > 0 && !settings.selectedFiles.includes(file.id)) return;
            const rows = file?.content || file?.data;
            if (!Array.isArray(rows)) return;

            rows.forEach((row: any, rowIndex: number) => {
                if (row?.type == null) return;
                const normal = normalFromRow(row);
                if (!normal) return;

                total++;
                const group = groupOf(row.type);
                if (settings.hiddenTypes[group]) return;

                const pole = toSphere(normal);
                const label = row.id != null && String(row.id).trim() !== ''
                    ? String(row.id)
                    : String(rowIndex + 1);

                // Same plane, seen in the Mohr diagram: one point per measured orientation.
                // n and −n give the same (σn, τ), so the antipodal copy would land on top of it.
                const { sigma_n, tau } = toMohr(toFrame(normal));
                if (isFinite(sigma_n) && isFinite(tau)) {
                    mohrPoints.push({ sigma: sigma_n, tau, color: colorFor(group), label });
                }

                // A plane's normal points both ways — n and −n describe the same plane — so each
                // datum is drawn at both ends of its diameter by default, which keeps a copy of
                // everything in view whichever way the sphere is turned. Failing that it can be
                // folded into the σ2 > 0 half-space (display Y is the σ2 axis: toDisplay maps
                // frame z → Y).
                //
                // The traction is linear in n, hence F_τ(−n) = −F_τ(n): the striation of the far
                // copy has to be reversed too, which is what keeps its sense of movement
                // consistent with the slip lines running past it there.
                const folded = settings.foldToPositiveSigma2 && pole.y < 0 ? -1 : 1;
                const copies = settings.plotDataBothSides ? [1, -1] : [folded];

                const measuredRaw = settings.showMeasuredStriations
                    ? striationFromRow(row, normal)
                    : null;
                const measuredDir = measuredRaw ? toSphere(measuredRaw) : null;
                const predictedDir = settings.showPredictedStriations && Array.isArray(row.predicted_striation)
                    ? toSphere(row.predicted_striation)
                    : null;

                copies.forEach((sign, copyIndex) => {
                    const primary = copyIndex === 0;
                    const p = pole.clone().multiplyScalar(sign);

                    if (settings.showPoles) {
                        const marker = new THREE.Mesh(
                            new THREE.SphereGeometry(settings.poleSize, 12, 12),
                            new THREE.MeshPhongMaterial({ color: hexToInt(colorFor(group)) })
                        );
                        marker.position.copy(p.clone().multiplyScalar(SURFACE_OFFSET));
                        content.add(marker);
                        if (primary) poles++;
                    }

                    if (settings.showDataNumbers) {
                        addLabel(
                            p.clone().multiplyScalar(SURFACE_OFFSET + settings.poleSize + 0.055),
                            label,
                            colorFor(group),
                            0.1
                        );
                    }

                    if (measuredDir) {
                        const dir = measuredDir.clone().multiplyScalar(sign);
                        if (addStriation(p, dir, settings.measuredStriationColor) && primary) {
                            measured++;
                        }
                    }

                    if (predictedDir) {
                        const dir = predictedDir.clone().multiplyScalar(sign);
                        if (addStriation(p, dir, settings.predictedStriationColor) && primary) {
                            predicted++;
                        }
                    }
                });
            });
        });

        setStats({ total, poles, measured, predicted });
        setMohr({
            sigmaRef: [S1_REF, S2, S3_REF],
            isoLines: mohrIso,
            slipCurves: mohrSlip,
            points: mohrPoints
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files, stressFrame, settings]);

    // ── Panels ───────────────────────────────────────────────────────────────

    const toggleType = (key: string) =>
        updateSettings({ hiddenTypes: { ...settings.hiddenTypes, [key]: !settings.hiddenTypes[key] } });

    const toggleFileSelection = (fileId: string) => {
        const selected = settings.selectedFiles.includes(fileId)
            ? settings.selectedFiles.filter(id => id !== fileId)
            : [...settings.selectedFiles, fileId];
        updateSettings({ selectedFiles: selected });
    };

    // Only files holding rows this sphere can place — the synthetic "Stress Inversion Results"
    // file carries metrics, not orientations, so it is left out of the list.
    const plottableFiles = useMemo(
        () => (files as any[] || []).filter(file => {
            const rows = file?.content || file?.data;
            return Array.isArray(rows) && rows.some((r: any) => r?.type != null && normalFromRow(r));
        }),
        [files]
    );

    const dataSelectionPanel = (
        <div className="space-y-4">
            <div>
                <h4 className="font-medium text-gray-800 mb-2">Files to Plot</h4>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    {plottableFiles.map(file => (
                        <label key={file.id} className="flex items-center py-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.selectedFiles.includes(file.id)}
                                onChange={() => toggleFileSelection(file.id)}
                                className="mr-2"
                            />
                            <span className="text-sm">
                                {file.name} ({(file.content || file.data)?.length || 0} rows)
                            </span>
                        </label>
                    ))}
                    {plottableFiles.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No file contains orientations to plot</p>
                    )}
                </div>
            </div>

            <div>
                <h4 className="font-medium text-gray-800 mb-2">Data Types to Plot</h4>
                <div className="border rounded-lg p-3 max-h-64 overflow-y-auto">
                    {groups.map(group => (
                        <label key={group.key} className="flex items-center justify-between py-1 cursor-pointer">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={!settings.hiddenTypes[group.key]}
                                    onChange={() => toggleType(group.key)}
                                    className="mr-2"
                                />
                                <span
                                    className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0"
                                    style={{ backgroundColor: colorFor(group.key) }}
                                />
                                <span className="text-sm">{labelFor(group.key)}</span>
                            </div>
                            <span className="text-xs text-gray-500 ml-2">{group.count}</span>
                        </label>
                    ))}
                    {groups.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No compatible data found</p>
                    )}
                </div>
            </div>

            {!stressFrame && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    No stress solution attached to these files — run an inversion to draw the slip
                    lines and place the data in the principal frame.
                </p>
            )}
        </div>
    );

    const settingsContent = (
        <div className="space-y-4">
            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Striations</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Measured</span>
                        <input
                            type="checkbox"
                            checked={settings.showMeasuredStriations}
                            onChange={e => updateSettings({ showMeasuredStriations: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showMeasuredStriations && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Measured Colour</span>
                            <input
                                type="color"
                                value={settings.measuredStriationColor}
                                onChange={e => updateSettings({ measuredStriationColor: e.target.value })}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    )}
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Predicted</span>
                        <input
                            type="checkbox"
                            checked={settings.showPredictedStriations}
                            onChange={e => updateSettings({ showPredictedStriations: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showPredictedStriations && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Predicted Colour</span>
                            <input
                                type="color"
                                value={settings.predictedStriationColor}
                                onChange={e => updateSettings({ predictedStriationColor: e.target.value })}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Length: {settings.striationLength}°
                        </label>
                        <input
                            type="range" min="4" max="30" step="1"
                            value={settings.striationLength}
                            onChange={e => updateSettings({ striationLength: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Width: {settings.striationWidth} px
                        </label>
                        <input
                            type="range" min="1" max="8" step="1"
                            value={settings.striationWidth}
                            onChange={e => updateSettings({ striationWidth: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Slip Lines</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Slip Lines</span>
                        <input
                            type="checkbox"
                            checked={settings.showSlipLines}
                            onChange={e => updateSettings({ showSlipLines: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showSlipLines && (
                        <>
                            <label className="flex items-center justify-between">
                                <span className="text-sm">Colour</span>
                                <input
                                    type="color"
                                    value={settings.slipLineColor}
                                    onChange={e => updateSettings({ slipLineColor: e.target.value })}
                                    className="w-10 h-6 rounded"
                                />
                            </label>
                            {/* The generator seeds curves at θ = i/nCurves × 90° for i in [1, nCurves),
                                so it draws one fewer than the number it is given; the slider is the
                                count actually drawn and adds the one back on the way in.
                                At 0 no curve of the family is seeded and only the principal circles
                                are left — the great circles through pairs of principal axes, which
                                the generator always emits and which are themselves slip lines. */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Count: {settings.nCurves - 1}
                                </label>
                                <input
                                    type="range" min="0" max="23" step="1"
                                    value={settings.nCurves - 1}
                                    onChange={e => updateSettings({ nCurves: parseInt(e.target.value) + 1 })}
                                    className="w-full"
                                />
                                {settings.nCurves <= 1 && (
                                    <p className="text-xs text-gray-500">
                                        Principal circles only: σ₁σ₃, plus σ₁σ₂ when σ₂ ≠ σ₁ and
                                        σ₂σ₃ when σ₂ ≠ σ₃.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Equipotentials</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Equipotentials</span>
                        <input
                            type="checkbox"
                            checked={settings.showEquipotential}
                            onChange={e => updateSettings({ showEquipotential: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showEquipotential && (
                        <>
                            <label className="flex items-center justify-between">
                                <span className="text-sm">Colour</span>
                                <input
                                    type="color"
                                    value={settings.equipotentialColor}
                                    onChange={e => updateSettings({ equipotentialColor: e.target.value })}
                                    className="w-10 h-6 rounded"
                                />
                            </label>
                            {/* Same off-by-one as the slip lines: the generator draws nIsoCurves−1. */}
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Count: {settings.nIsoCurves - 1}
                                </label>
                                <input
                                    type="range" min="1" max="23" step="1"
                                    value={settings.nIsoCurves - 1}
                                    onChange={e => updateSettings({ nIsoCurves: parseInt(e.target.value) + 1 })}
                                    className="w-full"
                                />
                            </div>
                            <label className="flex items-center justify-between">
                                <span className="text-sm" title="Mohr-circle construction instead of a binary search on σn">
                                    Parametric
                                </span>
                                <input
                                    type="checkbox"
                                    checked={settings.useParametricEquipotentials}
                                    onChange={e => updateSettings({ useParametricEquipotentials: e.target.checked })}
                                    className="rounded"
                                />
                            </label>
                        </>
                    )}
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Special Meridian</span>
                        <input
                            type="checkbox"
                            checked={settings.showSpecialEquipotential}
                            onChange={e => updateSettings({ showSpecialEquipotential: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showSpecialEquipotential && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Meridian Colour</span>
                            <input
                                type="color"
                                value={settings.specialEquipotentialColor}
                                onChange={e => updateSettings({ specialEquipotentialColor: e.target.value })}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    )}
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Curve width: {settings.curveLineWidth} px
                        </label>
                        <input
                            type="range" min="1" max="8" step="1"
                            value={settings.curveLineWidth}
                            onChange={e => updateSettings({ curveLineWidth: parseInt(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Normal Stress Field</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm" title="Filled iso-contour bands of σn on the sphere surface">
                            Show σn Field
                        </span>
                        <input
                            type="checkbox"
                            checked={settings.showNormalStressField}
                            onChange={e => updateSettings({ showNormalStressField: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showNormalStressField && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Colour Table</label>
                                <select
                                    value={settings.colorTableName}
                                    onChange={e => updateSettings({ colorTableName: e.target.value })}
                                    className="w-full p-1.5 text-sm border rounded bg-white"
                                >
                                    {/* colorMapNames() returns boxed String objects */}
                                    {colorMapNames().map(name => String(name)).map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center justify-between">
                                <span className="text-sm" title="Iso-lines traced on the mesh by marching triangles">
                                    Iso-lines
                                </span>
                                <input
                                    type="checkbox"
                                    checked={settings.showNormalStressIsoLines}
                                    onChange={e => updateSettings({ showNormalStressIsoLines: e.target.checked })}
                                    className="rounded"
                                />
                            </label>
                            <p className="text-xs text-gray-500">
                                The band count follows the equipotential count above.
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Poles &amp; Axes</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Poles</span>
                        <input
                            type="checkbox"
                            checked={settings.showPoles}
                            onChange={e => updateSettings({ showPoles: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Pole size: {settings.poleSize.toFixed(3)}
                        </label>
                        <input
                            type="range" min="0.005" max="0.08" step="0.005"
                            value={settings.poleSize}
                            onChange={e => updateSettings({ poleSize: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Data Numbers</span>
                        <input
                            type="checkbox"
                            checked={settings.showDataNumbers}
                            onChange={e => updateSettings({ showDataNumbers: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Plot Data on Both Sides</span>
                        <input
                            type="checkbox"
                            checked={settings.plotDataBothSides}
                            onChange={e => updateSettings({ plotDataBothSides: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    <p className="text-xs text-gray-500">
                        A plane's normal points both ways, so each datum can be drawn at both ends
                        of its diameter — front and back of the sphere. Every datum then stays in
                        view whichever way the sphere is turned. The striation is reversed on the
                        far copy, so its sense still follows the slip lines running past it there.
                    </p>
                    {!settings.plotDataBothSides && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Keep Data in the σ₂ &gt; 0 Half</span>
                            <input
                                type="checkbox"
                                checked={settings.foldToPositiveSigma2}
                                onChange={e => updateSettings({ foldToPositiveSigma2: e.target.checked })}
                                className="rounded"
                            />
                        </label>
                    )}
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Stress Axes (σ₁ σ₂ σ₃)</span>
                        <input
                            type="checkbox"
                            checked={settings.showStressAxes}
                            onChange={e => updateSettings({ showStressAxes: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Geographic Axes (N/S, E/W, Up/Down)</span>
                        <input
                            type="checkbox"
                            checked={settings.showGeoAxes}
                            onChange={e => updateSettings({ showGeoAxes: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showGeoAxes && (
                        <label className="flex items-center justify-between">
                            <span className="text-sm">Geographic Axes Colour</span>
                            <input
                                type="color"
                                value={settings.geoAxesColor}
                                onChange={e => updateSettings({ geoAxesColor: e.target.value })}
                                className="w-10 h-6 rounded"
                            />
                        </label>
                    )}
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Axis Labels</span>
                        <input
                            type="checkbox"
                            checked={settings.showAxisLabels}
                            onChange={e => updateSettings({ showAxisLabels: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                </div>
            </div>

            <div className="pb-4 border-b">
                <h5 className="font-medium text-gray-800 mb-3">Mohr Diagram</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Show Mohr Panel</span>
                        <input
                            type="checkbox"
                            checked={settings.showMohrPanel}
                            onChange={e => updateSettings({ showMohrPanel: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    {settings.showMohrPanel && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Data point radius: {settings.mohrPointRadius.toFixed(1)}
                                </label>
                                <input
                                    type="range" min="1" max="8" step="0.5"
                                    value={settings.mohrPointRadius}
                                    onChange={e => updateSettings({ mohrPointRadius: parseFloat(e.target.value) })}
                                    className="w-full"
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                Shows the same two families as the sphere — equipotentials become
                                vertical lines, slip lines the curves crossing them — so it follows
                                the toggles above.
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div>
                <h5 className="font-medium text-gray-800 mb-3">Appearance</h5>
                <div className="space-y-3">
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Sphere Colour</span>
                        <input
                            type="color"
                            value={settings.sphereColor}
                            onChange={e => updateSettings({ sphereColor: e.target.value })}
                            className="w-10 h-6 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Background</span>
                        <input
                            type="color"
                            value={settings.backgroundColor}
                            onChange={e => updateSettings({ backgroundColor: e.target.value })}
                            className="w-10 h-6 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between">
                        <span className="text-sm">Auto-rotate</span>
                        <input
                            type="checkbox"
                            checked={settings.autoRotate}
                            onChange={e => updateSettings({ autoRotate: e.target.checked })}
                            className="rounded"
                        />
                    </label>
                    <button
                        onClick={() => {
                            cameraRef.current?.position.set(3, 2.4, 3);
                            controlsRef.current?.target.set(0, 0, 0);
                            controlsRef.current?.update();
                        }}
                        className="w-full text-xs px-3 py-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    >
                        Reset view
                    </button>
                </div>

                <div className="mt-4">
                    <h5 className="font-medium text-gray-800 mb-3">Data Colours</h5>
                    <div className="space-y-2">
                        {groups.map(group => (
                            <label key={group.key} className="flex items-center justify-between">
                                <span className="text-sm">{labelFor(group.key)}</span>
                                <input
                                    type="color"
                                    value={colorFor(group.key)}
                                    onChange={e => updateSettings({
                                        typeColors: { ...settings.typeColors, [group.key]: e.target.value }
                                    })}
                                    className="w-10 h-6 rounded"
                                />
                            </label>
                        ))}
                        {Object.keys(settings.typeColors).length > 0 && (
                            <button
                                onClick={() => updateSettings({ typeColors: {} })}
                                className="mt-2 w-full text-xs px-3 py-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                            >
                                Reset colours
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    // Colour-scale legend for the σn field. Drawn as plain HTML rather than vendoring keplerlit's
    // canvas overlay stack, so it matches the rest of the application's panels. The gradient is
    // sampled from the very LUT the bands use, so legend and sphere cannot drift apart.
    const legendGradient = useMemo(() => {
        try {
            const lut = createLut(settings.colorTableName, 128);
            lut.setMin(0);
            lut.setMax(1);
            const stops: string[] = [];
            for (let i = 0; i <= 16; i++) {
                const c = lut.getColor(i / 16);
                const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
                stops.push(`rgb(${to255(c.r)},${to255(c.g)},${to255(c.b)}) ${(i / 16) * 100}%`);
            }
            return stops.join(', ');
        } catch {
            return '#0066cc, #ffff00, #cc0000';
        }
    }, [settings.colorTableName]);

    // The sphere's own scale is arbitrary, so the legend is graduated like the Mohr axis beside
    // it: normalised, in the selected convention (σ1 = +1 geologist, −1 engineer; σ3 = 0).
    const sigmaNorm = (s: number) => {
        const u = (s - S1_REF) / (S3_REF - S1_REF);
        return isEngineer ? u - 1 : 1 - u;
    };

    const legend = fieldRange && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-white/85 rounded px-2 py-1.5 shadow-sm pointer-events-none">
            <div
                className="w-3 h-24 rounded-sm border border-gray-300"
                style={{ background: `linear-gradient(to top, ${legendGradient})` }}
            />
            <div className="flex flex-col justify-between h-24 text-[10px] text-gray-700 leading-none">
                <span>{sigmaNorm(fieldRange.max).toFixed(2)}</span>
                <span className="font-medium">σn</span>
                <span>{sigmaNorm(fieldRange.min).toFixed(2)}</span>
            </div>
        </div>
    );

    // ── Companion Mohr diagram (Taboada 1993, fig. 8b) ───────────────────────
    //
    // Everything is already in Mohr coordinates by the time it gets here; this only lays it out.
    // The three bounding circles come from (σ1, σ2, σ3), the vertical lines are the equipotentials
    // and the curves crossing them are the integral curves.
    //
    // Axes follow the application-wide convention, exactly as the inversion's own Mohr diagram:
    //   geologist (compression +): σ1 = +1, σ2 = +R, σ3 = 0  →  σ1 on the right
    //   engineer  (tension +):     σ1 = −1, σ2 = −R, σ3 = 0  →  σ1 on the left
    // The sphere works on its own arbitrary scale (σ1 = 1, σ3 = 3, tension-positive ordering), so
    // everything is normalised through sigmaN()/tauN() on the way in; τ is convention-invariant.
    const mohrPanel = useMemo(() => {
        if (!mohr) return null;
        const [s1Ref, s2Ref, s3Ref] = mohr.sigmaRef;
        const span = s3Ref - s1Ref;
        if (!(span > 0)) return null;

        /** Sphere scale → normalised σn of the selected convention. */
        const sigmaN = (s: number) => {
            const u = (s - s1Ref) / span;        // 0 at σ1, 1 at σ3
            return isEngineer ? u - 1 : 1 - u;
        };
        /** τ on the same normalised scale — same in both conventions. */
        const tauN = (t: number) => t / span;    // max 0.5

        const xMin = isEngineer ? -1 : 0;
        const W = MOHR_MARGIN.left + MOHR_SCALE + MOHR_MARGIN.right;
        const H = MOHR_MARGIN.top + 0.5 * MOHR_SCALE + MOHR_MARGIN.bottom;
        const X = (sigma: number) => MOHR_MARGIN.left + (sigmaN(sigma) - xMin) * MOHR_SCALE;
        const Y = (tau: number) => MOHR_MARGIN.top + (0.5 - tauN(tau)) * MOHR_SCALE;

        // Ends of the σn axis, whichever way round the convention puts them.
        const xLeft = MOHR_MARGIN.left;
        const xRight = MOHR_MARGIN.left + MOHR_SCALE;
        const yBase = Y(0);
        const yTop = Y(span / 2);

        /** Upper half-circle spanning [a, b] of the σn axis. */
        const semicircle = (a: number, b: number) => {
            const lo = Math.min(X(a), X(b));
            const hi = Math.max(X(a), X(b));
            const r = (hi - lo) / 2;
            return `M ${lo} ${yBase} A ${r} ${r} 0 0 1 ${hi} ${yBase}`;
        };

        const polyline = (pts: Array<[number, number]>) =>
            pts.map(([s, t], i) => `${i === 0 ? 'M' : 'L'} ${X(s).toFixed(2)} ${Y(t).toFixed(2)}`).join(' ');

        // The admissible region: outer half-disc with the two inner ones punched out (even-odd).
        const regionPath = [semicircle(s1Ref, s3Ref), 'Z', semicircle(s1Ref, s2Ref), 'Z',
            semicircle(s2Ref, s3Ref), 'Z'].join(' ');

        // σn colour bands — the very field the sphere's surface is painted with, which here comes
        // out as vertical bands since σn is the horizontal axis. Same LUT, same range, same band
        // count, so the two views read as one figure.
        let bands: Array<{ from: number; to: number; color: string }> = [];
        if (settings.showNormalStressField && fieldRange && fieldRange.max > fieldRange.min) {
            try {
                const lut = createLut(settings.colorTableName, 128);
                lut.setMin(0);
                lut.setMax(1);
                const nBands = settings.nIsoCurves + 1;
                const level = (i: number) =>
                    fieldRange.min + (i / (nBands - 1)) * (fieldRange.max - fieldRange.min);
                const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
                for (let i = 0; i < nBands - 1; i++) {
                    const c = lut.getColor((level(i) - fieldRange.min) / (fieldRange.max - fieldRange.min));
                    const a = X(level(i));
                    const b = X(level(i + 1));
                    bands.push({
                        from: Math.min(a, b),
                        to: Math.max(a, b),
                        color: `rgb(${to255(c.r)},${to255(c.g)},${to255(c.b)})`
                    });
                }
                bands.sort((p, q) => p.from - q.from);
            } catch {
                bands = [];
            }
        }

        const clipId = `mohr-region-${mohrClipId}`;

        return (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <clipPath id={clipId}>
                        <path d={regionPath} clipRule="evenodd" />
                    </clipPath>
                </defs>

                {/* σn field, clipped to the Mohr region */}
                {bands.length > 0 && (
                    <g clipPath={`url(#${clipId})`}>
                        {bands.map((b, i) => (
                            <rect
                                key={`band-${i}`}
                                x={b.from} y={yTop} width={Math.max(0, b.to - b.from)} height={yBase - yTop}
                                fill={b.color}
                            />
                        ))}
                    </g>
                )}

                {/* Axes */}
                <line x1={xLeft} y1={yBase} x2={xRight + 14} y2={yBase} stroke="#333" strokeWidth={1.2} />
                <polygon points={`${xRight + 22},${yBase} ${xRight + 13},${yBase - 4} ${xRight + 13},${yBase + 4}`} fill="#333" />
                <line x1={xLeft} y1={yBase} x2={xLeft} y2={yTop - 14} stroke="#333" strokeWidth={1.2} />
                <polygon points={`${xLeft},${yTop - 22} ${xLeft - 4},${yTop - 13} ${xLeft + 4},${yTop - 13}`} fill="#333" />
                <text x={xRight + 20} y={yBase + 18} fontSize={13} fill="#333">σn</text>
                <text x={xLeft - 30} y={yTop - 16} fontSize={13} fill="#333">τ</text>

                {/* Mohr region: outer circle (σ1, σ3) and the two inner ones */}
                <path d={semicircle(s1Ref, s3Ref)} fill="none" stroke="#333" strokeWidth={1.4} />
                <path d={semicircle(s1Ref, s2Ref)} fill="none" stroke="#333" strokeWidth={1.2} />
                <path d={semicircle(s2Ref, s3Ref)} fill="none" stroke="#333" strokeWidth={1.2} />

                {/* Equipotentials — vertical, σn being constant along each of them */}
                {mohr.isoLines.map((iso, i) => (
                    <line
                        key={`iso-${i}`}
                        x1={X(iso.sigma)} y1={Y(iso.tauMin)}
                        x2={X(iso.sigma)} y2={Y(iso.tauMax)}
                        stroke={settings.equipotentialColor}
                        strokeWidth={0.9}
                    />
                ))}

                {/* Integral curves */}
                {mohr.slipCurves.map((curve, i) => (
                    <path
                        key={`slip-${i}`}
                        d={polyline(curve)}
                        fill="none"
                        stroke={settings.slipLineColor}
                        strokeWidth={0.9}
                        opacity={0.9}
                    />
                ))}

                {/* Measured planes, in their data-type colours — the same ones the poles carry */}
                {mohr.points.map((p, i) => (
                    <circle
                        key={`pt-${i}`}
                        cx={X(p.sigma)} cy={Y(p.tau)} r={settings.mohrPointRadius}
                        fill={p.color} stroke="#fff" strokeWidth={0.8}
                    />
                ))}
                {settings.showDataNumbers && mohr.points.map((p, i) => (
                    <text
                        key={`lbl-${i}`}
                        x={X(p.sigma) + settings.mohrPointRadius + 2}
                        y={Y(p.tau) - settings.mohrPointRadius}
                        fontSize={11} fill={p.color}
                        stroke="#fff" strokeWidth={2.5} paintOrder="stroke"
                    >
                        {p.label}
                    </text>
                ))}

                {/* σ ticks. σ2 runs into its neighbours as R approaches 0 or 1; drop its label then. */}
                {([[s1Ref, 'σ₁'], [s2Ref, 'σ₂'], [s3Ref, 'σ₃']] as Array<[number, string]>).map(([v, name]) => (
                    <g key={name}>
                        <line x1={X(v)} y1={yBase} x2={X(v)} y2={yBase + 5} stroke="#333" strokeWidth={1.2} />
                        {(name !== 'σ₂' || Math.min(s2Ref - s1Ref, s3Ref - s2Ref) / span * MOHR_SCALE > 26) && (
                            <text x={X(v)} y={yBase + 20} fontSize={13} fill="#333" textAnchor="middle">{name}</text>
                        )}
                    </g>
                ))}
            </svg>
        );
    }, [
        mohr, isEngineer, fieldRange, mohrClipId,
        settings.equipotentialColor, settings.slipLineColor, settings.mohrPointRadius,
        settings.showNormalStressField, settings.colorTableName, settings.nIsoCurves,
        settings.showDataNumbers
    ]);

    const plotContent = (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="relative flex-1 min-h-0 w-full flex gap-2">
                <div className="relative flex-1 min-w-0">
                    <div ref={mountRef} className="w-full h-full border rounded-lg bg-white" />
                    {legend}
                </div>
                {settings.showMohrPanel && mohrPanel && (
                    <div
                        className="border rounded-lg bg-white p-2 flex flex-col justify-center overflow-hidden"
                        style={{ width: '38%', minWidth: 200, maxWidth: 560 }}
                    >
                        {mohrPanel}
                        <div className="text-[10px] text-gray-500 text-center mt-1">
                            Mohr diagram — equipotentials (vertical) and integral curves
                            <span className="block">
                                normalised, {isEngineer ? 'engineer (tension +)' : 'geologist (compression +)'}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {stats && (
                <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg mt-2 text-xs">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <h4 className="font-semibold text-sm">Data Summary</h4>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div><span className="font-medium">Total:</span> {stats.total}</div>
                        <div><span className="font-medium">Poles:</span> {stats.poles}</div>
                        <div className="flex items-center gap-1">
                            <span
                                className="inline-block w-3 h-0.5"
                                style={{ backgroundColor: settings.measuredStriationColor }}
                            />
                            <span className="font-medium">Measured:</span> {stats.measured}
                        </div>
                        <div className="flex items-center gap-1">
                            <span
                                className="inline-block w-3 h-0.5"
                                style={{ backgroundColor: settings.predictedStriationColor }}
                            />
                            <span className="font-medium">Predicted:</span> {stats.predicted}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <StablePlotWithSettings
            title={title}
            leftPanel={dataSelectionPanel}
            settingsPanel={settingsContent}
            borderColor="#d1d5db"
            borderWidth={1}
            settingsPanelWidth={320}
            leftPanelWidth={320}
            initialSettingsOpen={currentState.open}
            initialLeftPanelOpen={showDataPanel}
            showLeftPanelButton={true}
            leftPanelButtonIcon={<Layers size={16} />}
            onLeftPanelToggle={setShowDataPanel}
            onSettingsToggle={toggleSettingsPanel}
        >
            {plotContent}
        </StablePlotWithSettings>
    );
};

export default SphereComponent;
