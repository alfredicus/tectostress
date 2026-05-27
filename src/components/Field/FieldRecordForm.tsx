import React, { useState, useCallback } from 'react'
import {
    DataType, PlaneSubtype, LinearSubtype, MovementType,
    OrientationConvention, FieldRecord,
    MOVEMENT_TYPE_LABELS, createEmptyRecord,
} from './types'
import SensorCapture from './SensorCapture'
import { CombinedSnapshot } from './useDeviceOrientation'

// Graceful degradation on desktop
let Geolocation: any = null
let Camera: any = null
let CameraResultType: any = null
let CameraSource: any = null

try {
    const geo = require('@capacitor/geolocation')
    Geolocation = geo.Geolocation
} catch { /* browser */ }

try {
    const cam = require('@capacitor/camera')
    Camera = cam.Camera
    CameraResultType = cam.CameraResultType
    CameraSource = cam.CameraSource
} catch { /* browser */ }

// -----------------------------------------------------------------------

const PLANE_SUBTYPES: { value: PlaneSubtype; label: string }[] = [
    { value: 'tension_fracture', label: 'Tension fracture' },
    { value: 'stylolite_plane',  label: 'Stylolite plane' },
    { value: 'joint',            label: 'Joint' },
    { value: 'bedding',          label: 'Bedding' },
    { value: 'cleavage',         label: 'Cleavage' },
    { value: 'other_plane',      label: 'Other plane' },
]

const LINEAR_SUBTYPES: { value: LinearSubtype; label: string }[] = [
    { value: 'stylolite_pick',          label: 'Stylolite pick' },
    { value: 'mineral_lineation',       label: 'Mineral lineation' },
    { value: 'intersection_lineation',  label: 'Intersection lineation' },
    { value: 'fold_axis',               label: 'Fold axis' },
    { value: 'other_linear',            label: 'Other linear' },
]

const MOVEMENT_OPTIONS = Object.entries(MOVEMENT_TYPE_LABELS) as [MovementType, string][]

// -----------------------------------------------------------------------

interface Props {
    onSave: (record: FieldRecord) => void
    onCancel: () => void
}

// Steps: type → capture → details
type Step = 'type' | 'capture' | 'details'

export default function FieldRecordForm({ onSave, onCancel }: Props) {
    const [record, setRecord] = useState<FieldRecord>(createEmptyRecord())
    const [step, setStep] = useState<Step>('type')
    const [gpsLoading, setGpsLoading] = useState(false)
    const [gpsError, setGpsError] = useState<string | null>(null)
    // Store the last combined snapshot for the confirmation block
    const [captured, setCaptured] = useState<CombinedSnapshot | null>(null)

    // ---- GPS (manual, not blocking) ------------------------------------
    const acquireGps = useCallback(async () => {
        setGpsLoading(true)
        setGpsError(null)
        try {
            if (Geolocation) {
                const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
                setRecord(r => ({
                    ...r,
                    gps: {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        altitude: pos.coords.altitude ?? null,
                        accuracy: pos.coords.accuracy,
                        timestamp: pos.timestamp,
                    }
                }))
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        setRecord(r => ({
                            ...r,
                            gps: {
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude,
                                altitude: pos.coords.altitude ?? null,
                                accuracy: pos.coords.accuracy,
                                timestamp: pos.timestamp,
                            }
                        }))
                        setGpsLoading(false)
                    },
                    err => { setGpsError(err.message); setGpsLoading(false) },
                    { enableHighAccuracy: true, timeout: 15000 }
                )
                return
            } else {
                setGpsError('GPS not available on this device.')
            }
        } catch (e: any) {
            setGpsError(e.message ?? 'GPS error')
        }
        setGpsLoading(false)
    }, [])

    // ---- Photo capture ------------------------------------------------
    async function addPhoto() {
        try {
            if (Camera && CameraResultType && CameraSource) {
                const photo = await Camera.getPhoto({
                    quality: 80,
                    allowEditing: false,
                    resultType: CameraResultType.DataUrl,
                    source: CameraSource.Camera,
                })
                if (photo.dataUrl) {
                    setRecord(r => ({ ...r, photos: [...r.photos, photo.dataUrl!] }))
                }
            } else {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.capture = 'environment'
                input.onchange = () => {
                    const file = input.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = e => {
                        const dataUrl = e.target?.result as string
                        setRecord(r => ({ ...r, photos: [...r.photos, dataUrl] }))
                    }
                    reader.readAsDataURL(file)
                }
                input.click()
            }
        } catch (e: any) {
            console.warn('Camera error:', e)
        }
    }

    function removePhoto(idx: number) {
        setRecord(r => ({ ...r, photos: r.photos.filter((_, i) => i !== idx) }))
    }

    // ---- Validation ---------------------------------------------------
    function canAdvanceFromType() {
        if (record.dataType === 'plane')  return !!record.planeSubtype
        if (record.dataType === 'linear') return !!record.linearSubtype
        return true
    }

    function canSave() {
        if (!record.plane) return false
        if (record.dataType === 'striated_fault') return !!record.movementType
        return true
    }

    // ---- One-click capture handler ------------------------------------
    function handleCapture(snap: CombinedSnapshot) {
        setCaptured(snap)
        setRecord(r => ({
            ...r,
            plane: snap.plane,
            // For striated_fault and linear, also store striation
            striation: (r.dataType === 'striated_fault') ? snap.striation : undefined,
        }))
    }

    // ====================================================================
    // STEP 1: TYPE SELECTION
    // ====================================================================
    if (step === 'type') {
        return (
            <div className="flex flex-col gap-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">1 — Select data type</h2>

                {/* Convention toggle */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Convention:</span>
                    <button
                        onClick={() => setRecord(r => ({
                            ...r,
                            convention: r.convention === 'dip_direction' ? 'strike_rhr' : 'dip_direction'
                        }))}
                        className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    >
                        {record.convention === 'dip_direction' ? 'Dip Dir / Dip' : 'Strike / Dip (RHR)'}
                    </button>
                </div>

                {/* Data type cards */}
                <div className="grid grid-cols-1 gap-3">
                    {([
                        { value: 'plane',          label: 'Plane',          desc: 'Tension fracture, stylolite plane, joint, bedding…' },
                        { value: 'linear',          label: 'Linear',         desc: 'Stylolite pick, mineral lineation, fold axis…' },
                        { value: 'striated_fault',  label: 'Striated fault', desc: 'Fault plane + slickenline (one-click capture)' },
                    ] as { value: DataType; label: string; desc: string }[]).map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setRecord(r => ({ ...r, dataType: opt.value, planeSubtype: undefined, linearSubtype: undefined }))}
                            className={`p-4 rounded-lg border-2 text-left transition-colors ${
                                record.dataType === opt.value
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }`}
                        >
                            <div className="font-semibold text-gray-800 dark:text-gray-100">{opt.label}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</div>
                        </button>
                    ))}
                </div>

                {/* Subtype selectors */}
                {record.dataType === 'plane' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Plane type</label>
                        <select
                            value={record.planeSubtype ?? ''}
                            onChange={e => setRecord(r => ({ ...r, planeSubtype: e.target.value as PlaneSubtype }))}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        >
                            <option value="">— select —</option>
                            {PLANE_SUBTYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                )}

                {record.dataType === 'linear' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lineation type</label>
                        <select
                            value={record.linearSubtype ?? ''}
                            onChange={e => setRecord(r => ({ ...r, linearSubtype: e.target.value as LinearSubtype }))}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                        >
                            <option value="">— select —</option>
                            {LINEAR_SUBTYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex gap-3 mt-2">
                    <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                        Cancel
                    </button>
                    <button
                        onClick={() => setStep('capture')}
                        disabled={!canAdvanceFromType()}
                        className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>
        )
    }

    // ====================================================================
    // STEP 2: CAPTURE (plane, or plane+striation in one click)
    // ====================================================================
    if (step === 'capture') {
        const isStriatedFault = record.dataType === 'striated_fault'
        const isLinear = record.dataType === 'linear'

        const hint = isStriatedFault
            ? 'Lay phone face-up on the fault surface — phone top aligned along the slickenline'
            : isLinear
            ? 'Lay phone along the lineation direction on the surface'
            : 'Lay phone face-up flat on the geological surface'

        const btnLabel = isStriatedFault
            ? 'Capture plane + striation'
            : isLinear
            ? 'Capture lineation'
            : 'Capture plane'

        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => setStep('type')} className="text-blue-500 text-sm">← Back</button>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        2 — {isStriatedFault ? 'Capture plane + striation' : isLinear ? 'Capture lineation' : 'Capture plane orientation'}
                    </h2>
                </div>

                {isStriatedFault && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                        <div className="font-semibold">One-click capture — both measured simultaneously:</div>
                        <div>• <span className="text-red-600 font-medium">Red arrow</span> = dip direction of the fault plane</div>
                        <div>• <span className="text-green-600 font-medium">Green dashed arrow</span> = slickenline trend</div>
                        <div>• Rake = angle between slickenline and strike, measured in the fault plane</div>
                    </div>
                )}

                <SensorCapture
                    convention={record.convention}
                    showStriation={isStriatedFault}
                    label={btnLabel}
                    hint={hint}
                    captured={captured}
                    onCapture={handleCapture}
                />

                <div className="flex gap-3 mt-2">
                    <button onClick={() => setStep('type')} className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                        Back
                    </button>
                    <button
                        onClick={() => setStep('details')}
                        disabled={!record.plane}
                        className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>
        )
    }

    // ====================================================================
    // STEP 3: DETAILS (movement type, GPS optional, photos, notes, save)
    // ====================================================================
    const stepNum = record.dataType === 'striated_fault' ? '3' : '3'

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
                <button onClick={() => setStep('capture')} className="text-blue-500 text-sm">← Back</button>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{stepNum} — Details</h2>
            </div>

            {/* Captured orientation summary */}
            {record.plane && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800 text-sm space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Plane orientation</span>
                        <button onClick={() => setStep('capture')} className="text-xs text-blue-500 underline">Re-capture</button>
                    </div>
                    <div className="font-mono text-gray-700 dark:text-gray-200">
                        {record.convention === 'dip_direction'
                            ? <>Azimuth&nbsp;<strong>{record.plane.dipDirection}°</strong>&nbsp;/&nbsp;Dip&nbsp;<strong>{record.plane.dip}°</strong></>
                            : <>Strike&nbsp;<strong>{record.plane.strike}°</strong>&nbsp;/&nbsp;Dip&nbsp;<strong>{record.plane.dip}°</strong></>
                        }
                        {record.convention === 'strike_rhr' && (
                            <span className="text-gray-400 ml-2">(dip dir. {record.plane.dipDirection}°)</span>
                        )}
                        {record.convention === 'dip_direction' && (
                            <span className="text-gray-400 ml-2">(strike {record.plane.strike}°)</span>
                        )}
                    </div>
                    {record.striation && (
                        <div className="font-mono text-green-700 dark:text-green-400">
                            Rake&nbsp;<strong>{record.striation.pitch}°&thinsp;{record.striation.pitchSide}</strong>
                            &nbsp;·&nbsp;Trend&nbsp;<strong>{record.striation.trend}°</strong>&nbsp;/&nbsp;Plunge&nbsp;<strong>{record.striation.plunge}°</strong>
                        </div>
                    )}
                </div>
            )}

            {/* Movement type — striated fault only */}
            {record.dataType === 'striated_fault' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type of movement <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={record.movementType ?? ''}
                        onChange={e => setRecord(r => ({ ...r, movementType: e.target.value as MovementType }))}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    >
                        <option value="">— select —</option>
                        {MOVEMENT_OPTIONS.map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* GPS — optional */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        GPS position <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    {!record.gps && !gpsLoading && (
                        <button
                            onClick={acquireGps}
                            className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-700"
                        >
                            Get GPS
                        </button>
                    )}
                    {record.gps && (
                        <button onClick={acquireGps} className="text-xs text-blue-500 underline">Refresh</button>
                    )}
                </div>
                {gpsLoading && <p className="text-sm text-gray-400 animate-pulse">Acquiring GPS…</p>}
                {gpsError && <p className="text-sm text-red-500">{gpsError}</p>}
                {!record.gps && !gpsLoading && (
                    <p className="text-xs text-gray-400">No GPS — tap "Get GPS" to acquire location.</p>
                )}
                {record.gps && !gpsLoading && (
                    <div className="text-sm font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded p-2 space-y-0.5">
                        <div>Lat: {record.gps.latitude.toFixed(6)}°</div>
                        <div>Lon: {record.gps.longitude.toFixed(6)}°</div>
                        {record.gps.altitude !== null && <div>Alt: {Math.round(record.gps.altitude)} m</div>}
                        <div className="text-gray-400">±{Math.round(record.gps.accuracy)} m</div>
                    </div>
                )}
            </div>

            {/* Photos */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Photos <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {record.photos.map((src, i) => (
                        <div key={i} className="relative w-20 h-20">
                            <img src={src} alt={`field-${i}`} className="w-20 h-20 object-cover rounded-lg border border-gray-300" />
                            <button
                                onClick={() => removePhoto(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={addPhoto}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-xs mt-0.5">Add</span>
                    </button>
                </div>
            </div>

            {/* Notes */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                    value={record.notes}
                    onChange={e => setRecord(r => ({ ...r, notes: e.target.value }))}
                    rows={3}
                    placeholder="Outcrop description, rock type, confidence…"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm resize-none"
                />
            </div>

            {/* Save */}
            <div className="flex gap-3 pt-2">
                <button onClick={onCancel} className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-medium">
                    Cancel
                </button>
                <button
                    onClick={() => onSave({ ...record, timestamp: new Date().toISOString() })}
                    disabled={!canSave()}
                    className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow"
                >
                    Save record
                </button>
            </div>
        </div>
    )
}
