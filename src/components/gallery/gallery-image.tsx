'use client';

import React, { useMemo, useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { buildSupabaseImageUrl, ImageSize, ImageSizes } from '@/lib/supabase-image-loader';
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
    const transformPreset = ImageSizes[size];

    const boundedLoader = useMemo(() => {
        return ({ src: loaderSrc, width, quality }: { src: string; width: number; quality?: number }) => {
            const boundedWidth = Math.min(width, transformPreset.width);

            return buildSupabaseImageUrl(loaderSrc, {
                width: boundedWidth,
                height: transformPreset.height,
                quality: quality ?? transformPreset.quality,
                resize: 'contain',
                format: 'webp',
            });
        };
    }, [transformPreset.height, transformPreset.quality, transformPreset.width]);

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
                    loader={boundedLoader}
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
