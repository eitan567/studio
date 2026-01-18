'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Photo } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SuggestionFanProps {
    suggestions: Photo[];
    onSelect: (photo: Photo) => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
}

export const SuggestionFan = ({
    suggestions,
    onSelect,
    onClose,
    anchorRect
}: SuggestionFanProps) => {
    const fanRef = useRef<HTMLDivElement>(null);
    const initialAnchorRef = useRef(anchorRect);

    // Initial position calculation (synchronous to prevent flash)
    const getInitialPosition = () => {
        if (!anchorRect) return { left: 0, top: 0 };
        return {
            left: anchorRect.left + anchorRect.width / 2,
            top: anchorRect.top + anchorRect.height / 2
        };
    };

    const [position, setPosition] = useState(getInitialPosition);

    // Update position if anchorRect changes (e.g. slight adjustments), though usually it's fixed on mount
    useEffect(() => {
        if (anchorRect) {
            initialAnchorRef.current = anchorRect;
            setPosition({
                left: anchorRect.left + anchorRect.width / 2,
                top: anchorRect.top + anchorRect.height / 2
            });
        }
    }, [anchorRect]);

    // Close on any scroll (including ScrollArea internal scroll)
    useEffect(() => {
        const handleScroll = () => {
            onClose();
        };

        // Use capture phase to catch all scroll events including internal ones
        document.addEventListener('scroll', handleScroll, true);
        return () => document.removeEventListener('scroll', handleScroll, true);
    }, [onClose]);

    // Close on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (fanRef.current && !fanRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const timeout = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 100);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    if (!anchorRect || suggestions.length === 0) return null;

    // Circle configuration
    const radius = 135; // Distance from center (increased 50%)
    const thumbSize = 90; // Thumbnail size in pixels (increased 50%)
    const photosToShow = suggestions.slice(0, 8);
    const angleStep = (2 * Math.PI) / Math.max(photosToShow.length, 1);
    const startAngle = -Math.PI / 2; // Start from top

    const fanContent = (
        <div
            ref={fanRef}
            className="fixed z-[9999] pointer-events-none"
            style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            {/* Center indicator */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg animate-pulse" />

            {/* Photos in circle */}
            {photosToShow.map((photo, index) => {
                const angle = startAngle + index * angleStep;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                return (
                    <button
                        key={photo.id}
                        className={cn(
                            "absolute pointer-events-auto rounded-lg overflow-hidden border-2 border-white",
                            "hover:border-primary hover:scale-125 transition-all duration-200",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                            "animate-in zoom-in-50 duration-300"
                        )}
                        style={{
                            width: `${thumbSize}px`,
                            height: `${thumbSize}px`,
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            transform: 'translate(-50%, -50%)',
                            animationDelay: `${index * 30}ms`,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3)'
                        }}
                        onClick={() => onSelect(photo)}
                        title={photo.alt || `Photo ${index + 1}`}
                    >
                        <Image
                            src={photo.src}
                            alt={photo.alt || ''}
                            fill
                            className="object-cover"
                            sizes={`${thumbSize}px`}
                            unoptimized
                        />
                    </button>
                );
            })}
        </div>
    );

    // Use portal to render in document.body (avoids overflow:hidden clipping)
    if (typeof window !== 'undefined') {
        return createPortal(fanContent, document.body);
    }

    return fanContent;
};

