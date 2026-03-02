import React from 'react';
import { TCompState } from '../VisualizationStateSystem';

export interface MCMCStatsSettings {
    showAcceptanceRate: boolean;
    showStressRatio: boolean;
    showMisfit: boolean;
}

export function createMCMCStatsSettings(): MCMCStatsSettings {
    return {
        showAcceptanceRate: true,
        showStressRatio: true,
        showMisfit: true
    };
}

export interface MCMCStatsCompState extends TCompState<MCMCStatsSettings> {
    type: 'mcmcStats';
}

export const MCMCStatsIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 24,
    className = ""
}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M6 17 C8 17, 9 8, 12 8 C15 8, 16 14, 18 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
        <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
);
