'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import supabaseLoader, { getOptimizedImageUrl, ImageSize, ImageSizes } from '@/lib/supabase-image-loader';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface GalleryImageProps extends Omit<ImageProps, 'src' | 'alt' | 'loader'> {
    src: string;
    alt: string;
    size?: ImageSize; // 'thumbnail' | 'preview' | 'full'
    aspectRatio?: number;
    className?: string;
    containerClassName?: string;
}

export function GalleryImage({
    src,
    alt,
    size = 'thumbnail',
    aspectRatio,
    className,
    containerClassName,
    onLoadingComplete,
    ...props
}: GalleryImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    // If src is a storage path, we can pre-generate a low-res blur or just use the loader
    // We'll use the loader implicitly by passing it to NextImage, or rely on src being a full URL if we pre-calculate.
    // The 'supabaseLoader' handles both paths and full URLs.

    // For 'fill' layout generally used in galleries:
    const isFill = props.fill !== false; // Default to fill if not specified otherwise, but standard NextImage defaults to false.
    // Actually, let's stick to NextImage defaults. If user passes fill, they pass fill.

    // Determine priority size for loader
    // We can pass `loader={supabaseLoader}` to NextImage.

    return (
        <div
            className={cn("relative overflow-hidden bg-muted w-full h-full", containerClassName)}
            style={aspectRatio ? { aspectRatio } : undefined}
        >


            {hasError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-20">
                    <AlertTriangle className="h-6 w-6 opacity-50" />
                </div>
            ) : (
                <Image
                    src={src}
                    alt={alt}
                    loader={supabaseLoader}
                    className={cn(
                        "transition-all duration-700 ease-in-out",
                        isLoading ? "opacity-0 scale-105 blur-md" : "opacity-100 scale-100 blur-0",
                        className
                    )}
                    onLoad={(e) => {
                        setIsLoading(false);
                        props.onLoad?.(e);
                        if (onLoadingComplete) {
                            onLoadingComplete(e.currentTarget);
                        }
                    }}
                    onError={() => {
                        setIsLoading(false);
                        setHasError(true);
                    }}
                    {...props}
                />
            )}
        </div>
    );
}
