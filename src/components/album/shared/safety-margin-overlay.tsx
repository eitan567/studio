import React from 'react';
import { PrintMarginSettings } from '@/hooks/use-settings';

interface SafetyMarginOverlayProps {
    margins: PrintMarginSettings;
    pxPerUnit: number; // pixels per cm
    color?: string;
    opacity?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/**
 * Renders a customizable safety margin indicator over a page surface.
 * Includes translucent borders that overlap in corners for a "double opacity" effect.
 * The overlay is purely visual (pointer-events:none) and never exported.
 */
export const SafetyMarginOverlay = ({ margins, pxPerUnit, color = '#334155', opacity = 0.15, lineStyle = 'dashed' }: SafetyMarginOverlayProps) => {
    // Current assumption: pxPerUnit is pixels per cm (e.g. 450 / 20 = 22.5)
    // We convert mm to px by dividing by 10 then multiplying by units
    const mmToPx = (mm: number) => (mm / 10) * pxPerUnit;

    const top = mmToPx(margins.top);
    const bottom = mmToPx(margins.bottom);
    const left = mmToPx(margins.left);
    const right = mmToPx(margins.right);
    
    const dashStyle = `1.5px ${lineStyle} ${color}`;
    
    // Convert hex to rgba for the fill
    const getRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const fillStyle = { backgroundColor: getRgba(color, opacity), position: 'absolute' as const };

    return (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden" aria-hidden="true" data-html2canvas-ignore="true">
            {/* Fill Areas (Overlapping rectangles for double opacity in corners) */}
            <div style={{ ...fillStyle, top: 0, left: 0, right: 0, height: top }} />
            <div style={{ ...fillStyle, bottom: 0, left: 0, right: 0, height: bottom }} />
            <div style={{ ...fillStyle, left: 0, top: 0, bottom: 0, width: left }} />
            <div style={{ ...fillStyle, right: 0, top: 0, bottom: 0, width: right }} />

            {/* Dashed Lines (Edge-to-edge) */}
            <div style={{ position: 'absolute', top: top, left: 0, right: 0, height: 0, borderTop: dashStyle }} />
            <div style={{ position: 'absolute', bottom: bottom, left: 0, right: 0, height: 0, borderTop: dashStyle }} />
            <div style={{ position: 'absolute', left: left, top: 0, bottom: 0, width: 0, borderLeft: dashStyle }} />
            <div style={{ position: 'absolute', right: right, top: 0, bottom: 0, width: 0, borderLeft: dashStyle }} />
        </div>
    );
};
