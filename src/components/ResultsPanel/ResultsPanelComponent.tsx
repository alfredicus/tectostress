// ResultsPanelComponent.tsx
import React from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { StressSolution } from '../types';

interface ResultsPanelComponentProps {
    solution: StressSolution | null;
    isExpanded: boolean;
    onToggle: () => void;
    onExport: () => void;
}

export const ResultsPanelComponent: React.FC<ResultsPanelComponentProps> = ({
    solution,
    isExpanded,
    onToggle,
    onExport
}) => {
    if (!solution) return null;

    const stressRatio = solution.stressRatio.toFixed(2);
    const fitPercentage = (Math.round((1 - solution.misfit) * 1000) / 10).toFixed(1);
    const misfitDegrees = (Math.trunc(solution.misfit * 100) / 100 * 180 / Math.PI).toFixed(1);

    return (
        <div className="mt-6 bg-white border rounded-lg shadow-sm overflow-hidden">
            <div
                className="flex justify-between items-center px-6 py-4 bg-blue-50 border-b cursor-pointer"
                onClick={onToggle}
            >
                <h3 className="text-lg font-medium text-blue-800">Simulation Results</h3>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onExport();
                        }}
                        className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                        title="Export Results"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-blue-600" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-blue-600" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-6 space-y-6">
                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Stress Ratio</h4>
                            <p className="text-2xl font-bold">{stressRatio}</p>
                            {solution.analysis && (
                                <p className="text-sm text-gray-600">
                                    Calculated: {solution.analysis.calculatedStressRatio.toFixed(3)}
                                </p>
                            )}
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-green-800 mb-2">Fit</h4>
                            <p className="text-2xl font-bold">{fitPercentage}%</p>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-amber-800 mb-2">Misfit</h4>
                            <p className="text-2xl font-bold">{misfitDegrees}°</p>
                        </div>
                    </div>

                    {/* Integration notice */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-purple-600">🎯</span>
                            <h4 className="text-sm font-medium text-purple-800">
                                Results Available for Visualization
                            </h4>
                        </div>
                        <p className="text-sm text-purple-700">
                            Your stress inversion results are now available. Use the visualizations below to explore
                            the stress state, view Mohr circles, plot data on stereonets, and analyze the solution.
                        </p>
                    </div>

                    {/* Euler Angles */}
                    {solution.analysis && (
                        <>
                            <div>
                                <h4 className="text-base font-medium mb-3">Euler Angles (ZXZ Convention)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">φ (Phi)</h5>
                                        <p className="text-xl font-bold">
                                            {solution.analysis.eulerAnglesDegrees.phi.toFixed(1)}°
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">θ (Theta)</h5>
                                        <p className="text-xl font-bold">
                                            {solution.analysis.eulerAnglesDegrees.theta.toFixed(1)}°
                                        </p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                        <h5 className="text-sm font-medium text-purple-800 mb-2">ψ (Psi)</h5>
                                        <p className="text-xl font-bold">
                                            {solution.analysis.eulerAnglesDegrees.psi.toFixed(1)}°
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Principal Stresses */}
                            <div>
                                <h4 className="text-base font-medium mb-3">Principal Stresses</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-red-800 mb-2">σ₁ (Maximum)</h5>
                                        <p className="text-lg font-bold">
                                            {solution.analysis.principalStresses.sigma1.value.toFixed(4)}
                                        </p>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-yellow-800 mb-2">σ₂ (Intermediate)</h5>
                                        <p className="text-lg font-bold">
                                            {solution.analysis.principalStresses.sigma2.value.toFixed(4)}
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h5 className="text-sm font-medium text-blue-800 mb-2">σ₃ (Minimum)</h5>
                                        <p className="text-lg font-bold">
                                            {solution.analysis.principalStresses.sigma3.value.toFixed(4)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResultsPanelComponent;