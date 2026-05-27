import React, { useEffect, useState } from 'react'
import { useDeviceOrientation, CombinedSnapshot, VirtualSensorValues } from './useDeviceOrientation'
import { OrientationConvention } from './types'

interface Props {
    convention: OrientationConvention
    showStriation: boolean          // true for striated_fault: shows rake + striation info
    label: string
    onCapture: (snap: CombinedSnapshot) => void
    captured?: CombinedSnapshot | null
    hint?: string
}

// ── Desktop simulator presets ────────────────────────────────────────────────
interface Preset {
    label: string
    values: VirtualSensorValues
}

const PRESETS: Preset[] = [
    { label: 'N45E / 60°',  values: { dipDirection: 45,  dip: 60,  rake: 30,  striaTrend: 45,  striaPlunge: 25 } },
    { label: 'N / 30°',     values: { dipDirection: 0,   dip: 30,  rake: 45,  striaTrend: 10,  striaPlunge: 15 } },
    { label: 'E / 45°',     values: { dipDirection: 90,  dip: 45,  rake: 60,  striaTrend: 90,  striaPlunge: 35 } },
    { label: 'S / 90° (vert)', values: { dipDirection: 180, dip: 90, rake: 80, striaTrend: 180, striaPlunge: 75 } },
]

// ── Slider row helper ────────────────────────────────────────────────────────
function SliderRow({
    label, value, min, max, step = 1, onChange,
}: {
    label: string; value: number; min: number; max: number; step?: number
    onChange: (v: number) => void
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-32 shrink-0">{label}</span>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="flex-1 accent-blue-500"
            />
            <span className="text-xs font-mono text-gray-700 dark:text-gray-200 w-10 text-right">{value}°</span>
        </div>
    )
}

// ── Desktop simulator panel ──────────────────────────────────────────────────
function VirtualPanel({
    showStriation, vals, onChange,
}: {
    showStriation: boolean
    vals: VirtualSensorValues
    onChange: (v: VirtualSensorValues) => void
}) {
    function set(partial: Partial<VirtualSensorValues>) {
        onChange({ ...vals, ...partial })
    }

    return (
        <div className="w-full rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
                {/* monitor icon */}
                <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
                    <path d="M8 21h8M12 17v4" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Desktop simulator</span>
                <span className="text-xs text-blue-500 dark:text-blue-400">— set values manually</span>
            </div>

            {/* Plane sliders */}
            <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Plane</p>
                <SliderRow label="Dip direction" value={vals.dipDirection} min={0} max={359} onChange={v => set({ dipDirection: v })} />
                <SliderRow label="Dip" value={vals.dip} min={0} max={90} onChange={v => set({ dip: v })} />
            </div>

            {/* Striation sliders (only for striated faults) */}
            {showStriation && (
                <div className="space-y-2 pt-1 border-t border-blue-200 dark:border-blue-700">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Striation</p>
                    <SliderRow label="Rake" value={vals.rake} min={0} max={90} onChange={v => set({ rake: v })} />
                    <SliderRow label="Trend" value={vals.striaTrend} min={0} max={359} onChange={v => set({ striaTrend: v })} />
                    <SliderRow label="Plunge" value={vals.striaPlunge} min={0} max={90} onChange={v => set({ striaPlunge: v })} />
                </div>
            )}

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-blue-200 dark:border-blue-700">
                <span className="text-xs text-gray-500 self-center">Presets:</span>
                {PRESETS.map(p => (
                    <button
                        key={p.label}
                        onClick={() => onChange(p.values)}
                        className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function SensorCapture({ convention, showStriation, label, onCapture, captured, hint }: Props) {
    const { reading, snapshot, requestPermission, virtualMode, setVirtualMode, virtualVals, setVirtualVals } = useDeviceOrientation()
    const [permAsked, setPermAsked] = useState(false)
    // After a short timeout, if no sensor data arrived we auto-suggest virtual mode
    const [noSensorDetected, setNoSensorDetected] = useState(false)

    useEffect(() => {
        if (!permAsked) {
            setPermAsked(true)
            requestPermission()
        }
    }, [permAsked, requestPermission])

    // Detect desktop (no orientation events after 1.5 s)
    useEffect(() => {
        if (reading.available || virtualMode) return
        const timer = setTimeout(() => {
            if (!reading.available) setNoSensorDetected(true)
        }, 1500)
        return () => clearTimeout(timer)
    }, [reading.available, virtualMode])

    function handleCapture() {
        const snap = snapshot()
        if (snap) onCapture(snap)
    }

    const { dipDirection, dip, strike, rake, pitchSide, striaTrend, striaPlunge, available, error } = reading

    // Primary plane display
    const planePrimary = convention === 'dip_direction'
        ? `${dipDirection}° / ${dip}°`
        : `${strike}° / ${dip}°`
    const planeSecondary = convention === 'dip_direction'
        ? `Strike ${strike}°`
        : `Dip dir. ${dipDirection}°`

    // Captured summary
    const capturedPlanePrimary = captured
        ? convention === 'dip_direction'
            ? `${captured.plane.dipDirection}° / ${captured.plane.dip}°`
            : `${captured.plane.strike}° / ${captured.plane.dip}°`
        : null

    return (
        <div className="flex flex-col items-center gap-4 py-2">
            {hint && (
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 italic px-2">{hint}</p>
            )}

            {/* ── Banner: auto-suggest virtual mode on desktop ─────────── */}
            {noSensorDetected && !virtualMode && (
                <div className="w-full rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No orientation sensor detected</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            You seem to be on a desktop. Enable the simulator to set values manually.
                        </p>
                    </div>
                    <button
                        onClick={() => setVirtualMode(true)}
                        className="text-xs font-semibold px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white transition-colors shrink-0"
                    >
                        Enable simulator
                    </button>
                </div>
            )}

            {/* ── Virtual mode toggle (when already active) ────────────── */}
            {virtualMode && (
                <div className="w-full flex items-center justify-between">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
                            <path d="M8 21h8M12 17v4" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        Desktop simulator active
                    </span>
                    <button
                        onClick={() => setVirtualMode(false)}
                        className="text-xs text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
                    >
                        Use real sensor
                    </button>
                </div>
            )}

            {/* ── Compass rose ─────────────────────────────────────────── */}
            <div className="relative">
                <svg width="160" height="160" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="74" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                    <circle cx="80" cy="80" r="60" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />

                    {/* Cardinal labels */}
                    <text x="80" y="12" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#374151">N</text>
                    <text x="152" y="84" textAnchor="middle" fontSize="11" fill="#6b7280">E</text>
                    <text x="80" y="156" textAnchor="middle" fontSize="11" fill="#6b7280">S</text>
                    <text x="8" y="84" textAnchor="middle" fontSize="11" fill="#6b7280">W</text>

                    {/* Tick marks every 30° */}
                    {Array.from({ length: 12 }, (_, i) => {
                        const angle = (i * 30 * Math.PI) / 180
                        return (
                            <line key={i}
                                x1={80 + 68 * Math.sin(angle)} y1={80 - 68 * Math.cos(angle)}
                                x2={80 + 74 * Math.sin(angle)} y2={80 - 74 * Math.cos(angle)}
                                stroke="#9ca3af" strokeWidth="1"
                            />
                        )
                    })}

                    {/* Striation trend line (green, dashed) — shown when showStriation */}
                    {showStriation && available && (
                        <g transform={`rotate(${striaTrend}, 80, 80)`}>
                            <line x1="80" y1="80" x2="80" y2="25" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeDasharray="5,3" />
                            <polygon points="80,18 76,30 84,30" fill="#16a34a" />
                            <line x1="80" y1="80" x2="80" y2="135" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3,3" opacity="0.5" />
                        </g>
                    )}

                    {/* Dip direction needle (red = dip dir, blue tail) */}
                    <g transform={`rotate(${dipDirection}, 80, 80)`}>
                        <line x1="80" y1="80" x2="80" y2="20" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                        <polygon points="80,14 75,26 85,26" fill="#ef4444" />
                        <line x1="80" y1="80" x2="80" y2="136" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,3" />
                    </g>

                    {/* Centre dot */}
                    <circle cx="80" cy="80" r="4" fill="#1f2937" />

                    {/* Dip value in centre */}
                    {available && (
                        <text x="80" y="96" textAnchor="middle" fontSize="10" fill="#6b7280">{dip}°</text>
                    )}
                </svg>

                {/* Legend dots */}
                {showStriation && (
                    <div className="absolute -bottom-1 right-0 flex flex-col gap-0.5 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-red-500" />
                            <span>Dip dir</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-green-600" style={{ borderTop: '2px dashed' }} />
                            <span>Stria</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Live readout ─────────────────────────────────────────── */}
            {error ? (
                <p className="text-sm text-red-500 text-center">{error}</p>
            ) : available ? (
                <div className="w-full space-y-2">
                    {/* Plane */}
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-gray-800 dark:text-gray-100">
                            {planePrimary}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {planeSecondary} &nbsp;·&nbsp; {convention === 'dip_direction' ? 'Dip dir. / Dip' : 'Strike / Dip'}
                        </div>
                    </div>

                    {/* Striation row */}
                    {showStriation && (
                        <div className="flex justify-center gap-6 text-sm bg-green-50 dark:bg-green-900/20 rounded-lg py-2 px-4">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Rake</div>
                                <div className="font-mono font-bold text-green-700 dark:text-green-400 text-lg">{rake}°&thinsp;{pitchSide}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 dark:text-gray-400">Trend / Plunge</div>
                                <div className="font-mono font-bold text-green-700 dark:text-green-400 text-lg">{striaTrend}° / {striaPlunge}°</div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm text-gray-400 animate-pulse">Waiting for sensors…</p>
            )}

            {/* ── Desktop simulator panel ───────────────────────────────── */}
            {virtualMode && (
                <VirtualPanel
                    showStriation={showStriation}
                    vals={virtualVals}
                    onChange={setVirtualVals}
                />
            )}

            {/* ── Capture button ────────────────────────────────────────── */}
            <button
                onClick={handleCapture}
                disabled={!available}
                className="w-full px-6 py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow"
            >
                {label}
            </button>

            {/* ── Captured confirmation ─────────────────────────────────── */}
            {captured && (
                <div className="w-full px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 space-y-0.5">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            Plane: {capturedPlanePrimary}
                        </span>
                        <button onClick={handleCapture} className="text-xs text-green-600 dark:text-green-400 underline ml-auto">
                            Re-capture
                        </button>
                    </div>
                    {showStriation && captured.striation && (
                        <div className="text-sm text-green-700 dark:text-green-300 pl-6">
                            Rake: {captured.striation.pitch}°&thinsp;{captured.striation.pitchSide}
                            &nbsp;·&nbsp; Trend/Plunge: {captured.striation.trend}°/{captured.striation.plunge}°
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
