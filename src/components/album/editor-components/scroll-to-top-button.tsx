'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (!scrollContainer) return;

        const handleScroll = () => {
            if (scrollContainer.scrollTop > 100) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, [scrollAreaRef, dependency]);

    const scrollToTop = () => {
        const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <Button
            variant="secondary"
            size="icon"
            className={cn(
                "absolute bottom-4 right-4 z-49 rounded-full shadow-lg transition-all duration-300",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none",
                className
            )}
            onClick={scrollToTop}
        >
            <ArrowUp className="h-5 w-5" />
        </Button>
    );
}
