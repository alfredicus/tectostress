// ConfigTab.tsx
// Application-wide configuration panel (displayed as the "Config" tab).

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettings, StressConvention } from './SettingsContext';

// ─── Convention descriptions (shown in the radio cards) ───────────────────────

interface ConventionOption {
    value: StressConvention;
    label: string;
    badge: string;
    description: string;
    details: string[];
    example: string;
}

const CONVENTION_OPTIONS: ConventionOption[] = [
    {
        value: 'geologist',
        label: 'Geologist',
        badge: 'Structural geology default',
        description:
            'Compression is positive. σ₁ is the maximum compressive stress axis — the direction in which the crust is most strongly squeezed.',
        details: [
            'σ₁ ≥ σ₂ ≥ σ₃  (all positive for a compressive regime)',
            'σ₁ = most compressive  /  σ₃ = least compressive',
            'Stress ratio  R = (σ₂ − σ₃) / (σ₁ − σ₃)  ∈ [0, 1]',
            'Anderson classification: σ₁ vertical → normal faults',
            'Used by Angelier, Etchecopar, Michael, Gephart & Forsyth',
        ],
        example: 'σ₁ = 1  →  σ₂ = R  →  σ₃ = 0    (Mohr x-axis: 0 on left, 1 on right)',
    },
    {
        value: 'engineer',
        label: 'Engineer',
        badge: 'Continuum mechanics / rock mechanics',
        description:
            'Tension is positive. σ₁ is still the most compressive axis — same physical direction as in the geologist convention — but its value is negative (compression < 0).',
        details: [
            'σ₁ ≤ σ₂ ≤ σ₃  (most compressive has the most negative value)',
            'σ₁ = most compressive (negative)  /  σ₃ = least compressive (= 0)',
            'Same axis directions as geologist; only the signs of the values are flipped',
            'Compressive stresses appear on the negative x-axis of the Mohr diagram',
            'Used in rock mechanics, geomechanics, FEM codes (ABAQUS, FLAC …)',
        ],
        example: 'σ₁ = −1 (most compressive)  →  σ₂ = −R  →  σ₃ = 0   (Mohr x-axis: −1 on left, 0 on right)',
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ConfigTab: React.FC = () => {
    const { settings, updateSettings, resetSettings } = useSettings();

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-8">
            {/* ── Section: Principal stress convention ── */}
            <section>
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-xl font-bold text-indigo-800">
                        Principal Stress Convention
                    </h2>
                    <button
                        onClick={resetSettings}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                        title="Reset all settings to defaults"
                    >
                        <RotateCcw size={13} />
                        Reset to defaults
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                    Controls how principal stresses are labelled and signed in the inversion
                    results (Mohr diagram, eigenvector table, exported data).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CONVENTION_OPTIONS.map(opt => {
                        const selected = settings.stressConvention === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => updateSettings({ stressConvention: opt.value })}
                                className={`text-left rounded-xl border-2 p-5 transition-all
                                    ${selected
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                                    }`}
                            >
                                {/* Title row */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-base font-semibold text-gray-900">
                                        {opt.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">{opt.badge}</span>
                                        {/* Radio indicator */}
                                        <span
                                            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors
                                                ${selected
                                                    ? 'border-indigo-500 bg-indigo-500'
                                                    : 'border-gray-300 bg-white'
                                                }`}
                                        />
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-gray-600 mb-3">{opt.description}</p>

                                {/* Detail bullets */}
                                <ul className="space-y-1 mb-3">
                                    {opt.details.map((d, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                                            <span className="mt-0.5 text-indigo-400 flex-shrink-0">•</span>
                                            {d}
                                        </li>
                                    ))}
                                </ul>

                                {/* Example box */}
                                <div className="bg-gray-100 rounded-lg px-3 py-2">
                                    <span className="text-xs font-mono text-gray-600">{opt.example}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Active summary pill */}
                <div className="mt-4 flex items-center gap-2">
                    <span className="text-sm text-gray-500">Currently active:</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {CONVENTION_OPTIONS.find(o => o.value === settings.stressConvention)?.label} convention
                    </span>
                </div>
            </section>

            {/* ── Future settings sections can go here ── */}
            <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 text-center">
                More preferences coming soon
            </div>
        </div>
    );
};

export default ConfigTab;
