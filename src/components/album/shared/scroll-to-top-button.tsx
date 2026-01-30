'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
    scrollAreaRef: React.RefObject<HTMLDivElement | null>;
    className?: string;
    dependency?: any;
}

export function ScrollToTopButton({ scrollAreaRef, className, dependency }: ScrollToTopButtonProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Try to find the scroll container - either the Radix viewport or the element itself
        let scrollContainer: Element | null = null;

        if (scrollAreaRef.current) {
            // Check if the ref IS the viewport (has the data attribute)
            if (scrollAreaRef.current.hasAttribute('data-radix-scroll-area-viewport')) {
                scrollContainer = scrollAreaRef.current;
            } else {
                // Otherwise, try to find the Radix scroll viewport inside
                scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            }

            // If still not found, use the element itself (for direct div refs)
            if (!scrollContainer) {
                scrollContainer = scrollAreaRef.current;
            }
        }



        if (!scrollContainer) return;

        const handleScroll = () => {

            if (scrollContainer!.scrollTop > 100) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        // Check scroll position immediately when dependency changes
        handleScroll();

        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer!.removeEventListener('scroll', handleScroll);
    }, [scrollAreaRef, dependency]);

    const scrollToTop = () => {
        // Find the actual scrollable element
        let scrollContainer: Element | null = null;

        if (scrollAreaRef.current) {
            // Check if the ref IS the viewport (has the data attribute)
            if (scrollAreaRef.current.hasAttribute('data-radix-scroll-area-viewport')) {
                scrollContainer = scrollAreaRef.current;
            } else {
                // Otherwise, try to find the viewport inside
                scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            }

            // If still not found, use the element itself
            if (!scrollContainer) {
                scrollContainer = scrollAreaRef.current;
            }
        }

        if (scrollContainer) {
            // Use smooth scroll
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });

            // Safety: ensure we reach top after smooth scroll animation
            // This handles cases where virtualizer might interfere
            const el = scrollContainer;
            setTimeout(() => {
                if (el.scrollTop > 0) {
                    el.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 500);
        }
    };

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center rounded-full shadow-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 w-10 transition-all duration-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
                className
            )}
            onClick={scrollToTop}
        >
            <ArrowUp className="h-5 w-5" />
        </button>
    );
}
