'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImageIcon, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { aiEnhancePhoto } from '@/ai/ai-enhance-photo';
import { Photo } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type Preset = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

const PRESETS: Preset[] = [
  {
    id: 'auto-balance',
    label: 'Auto Balance',
    description: 'Balanced light, contrast and colors.',
    prompt: 'Apply clean auto-balance for exposure, contrast and white balance.',
  },
  {
    id: 'details',
    label: 'Sharper Details',
    description: 'Improve details while keeping it natural.',
    prompt: 'Increase clarity and micro-contrast, preserve natural texture and avoid halos.',
  },
  {
    id: 'clean-noise',
    label: 'Noise Cleanup',
    description: 'Reduce noise and keep edges crisp.',
    prompt: 'Reduce image noise and compression artifacts while preserving fine edges.',
  },
  {
    id: 'portrait',
    label: 'Portrait Natural',
    description: 'Natural skin tones and soft highlights.',
    prompt: 'Improve skin tones and portrait lighting while keeping a realistic, natural look.',
  },
  {
    id: 'vibrant',
    label: 'Vibrant Colors',
    description: 'Richer color without over-saturation.',
    prompt: 'Enhance color depth and local contrast with restrained, print-friendly vibrancy.',
  },
];

export interface AiPhotoEnhancerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePhoto: Photo | null;
  sourceImageUrl: string | null;
  onApprove: (enhancedImageUrl: string, appliedPrompt: string) => Promise<void>;
}

export function AiPhotoEnhancerSheet({
  open,
  onOpenChange,
  sourcePhoto,
  sourceImageUrl,
  onApprove,
}: AiPhotoEnhancerSheetProps) {
  const { toast } = useToast();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [lastAppliedPrompt, setLastAppliedPrompt] = useState('');

  useEffect(() => {
    if (!open) return;
    setResultImageUrl(null);
    setResultOpen(false);
    setLastAppliedPrompt('');
  }, [open, sourceImageUrl]);

  const selectedPreset = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedPresetId) || PRESETS[0],
    [selectedPresetId]
  );
  const customPromptPreview = customPrompt.trim();

  const handleEnhance = useCallback(async () => {
    if (!sourceImageUrl) return;

    setIsEnhancing(true);
    try {
      const result = await aiEnhancePhoto({
        imageUrl: sourceImageUrl,
        presetPrompt: selectedPreset?.prompt,
        customPrompt: customPrompt.trim() || undefined,
      });

      if (!result.success || !result.imageUrl) {
        throw new Error(result.error || 'Enhancement failed');
      }

      setLastAppliedPrompt(result.appliedPrompt || '');
      setResultImageUrl(result.imageUrl);
      setResultOpen(true);
    } catch (err) {
      toast({
        title: 'Enhancement failed',
        description: err instanceof Error ? err.message : 'Could not enhance image.',
        variant: 'destructive',
      });
    } finally {
      setIsEnhancing(false);
    }
  }, [customPrompt, selectedPreset, sourceImageUrl, toast]);

  const handleApprove = useCallback(async () => {
    if (!resultImageUrl) return;

    setIsApplying(true);
    try {
      await onApprove(resultImageUrl, lastAppliedPrompt);
      setResultOpen(false);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Could not apply enhanced image',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  }, [lastAppliedPrompt, onApprove, onOpenChange, resultImageUrl, toast]);

  const handleTryAgain = useCallback(async () => {
    await handleEnhance();
  }, [handleEnhance]);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (isEnhancing || isApplying) return;
          if (!nextOpen) {
            setResultOpen(false);
          }
          onOpenChange(nextOpen);
        }}
      >
        <SheetContent
          side="left"
          className="w-[min(1100px,92vw)] max-w-none p-0 sm:max-w-none"
        >
          <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_right,_hsl(var(--primary)/0.1),_transparent_42%),radial-gradient(circle_at_bottom_left,_hsl(var(--muted)/0.42),_transparent_38%)]">
            <div className="border-b border-border/55 bg-background/82 backdrop-blur-md">
              <SheetHeader className="px-6 pb-3.5 pt-3 pr-14">
                <div className="inline-flex w-fit items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary/90">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Photo Enhancement
                </div>
                <SheetTitle className="mt-3 text-[2rem] leading-none tracking-tight">
                  Enhance With AI
                </SheetTitle>
                <SheetDescription className="mt-2 max-w-[680px] text-sm leading-relaxed text-muted-foreground">
                  Pick a preset and optional prompt, then generate an enhanced image.
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden px-6 pb-4 pt-3 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="order-2 flex min-h-0 flex-col xl:order-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Enhancement preset
                  </Label>
                  <span className="text-xs text-muted-foreground">{PRESETS.length} options</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={cn(
                        'w-full rounded-lg px-3.5 py-2.5 text-left transition-all',
                        selectedPresetId === preset.id
                          ? 'bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.45)]'
                          : 'bg-background/55 hover:bg-background/80 ring-1 ring-border/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium leading-tight">{preset.label}</div>
                        {selectedPresetId === preset.id && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex min-h-0 flex-1 flex-col">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Custom prompt (optional)
                  </Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Example: make it brighter, warmer, and cleaner but keep natural skin tones."
                    className="mt-2 min-h-0 flex-1 resize-none rounded-lg bg-background/65 ring-1 ring-border/50"
                    disabled={isEnhancing}
                  />
                </div>

                <div className="mt-3 flex shrink-0 items-center justify-between gap-4 rounded-lg bg-background/55 px-3 py-2.5 ring-1 ring-border/45">
                  <div className="text-sm text-muted-foreground">
                    Applying <span className="font-medium text-foreground">{selectedPreset.label}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={handleEnhance}
                    disabled={!sourceImageUrl || isEnhancing}
                    className="h-10 min-w-[150px] text-base"
                  >
                    {isEnhancing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Enhance
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="order-1 flex min-h-0 flex-col xl:order-2">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {sourcePhoto?.alt || 'Selected photo'}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {sourcePhoto?.width && sourcePhoto?.height
                      ? `${sourcePhoto.width} x ${sourcePhoto.height}`
                      : 'Resolution unknown'}
                  </span>
                </div>
                <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top,_hsl(var(--muted)/0.48),_transparent_58%),linear-gradient(to_bottom,_hsl(var(--muted)/0.16),_hsl(var(--muted)/0.32))] p-4 ring-1 ring-border/40">
                  {sourceImageUrl ? (
                    <img
                      src={sourceImageUrl}
                      alt={sourcePhoto?.alt || 'Current image'}
                      className="h-full w-auto max-h-full max-w-full rounded-md object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      Image source is not available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={resultOpen}
        onOpenChange={(nextOpen) => {
          if (isEnhancing || isApplying) return;
          setResultOpen(nextOpen);
        }}
      >
        <DialogContent className="flex h-[min(900px,92vh)] w-[min(1200px,96vw)] max-w-none flex-col overflow-hidden p-0">
          <div className="border-b bg-gradient-to-br from-background via-muted/10 to-muted/40 px-7 py-6">
            <DialogHeader className="space-y-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI Enhancement Preview
              </div>
              <DialogTitle className="text-2xl tracking-tight">
                Enhanced Image Ready
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Compare the original and enhanced versions, then decide whether to apply the new image.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                <ImageIcon className="h-3.5 w-3.5" />
                Original
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enhanced Preview
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Requested: {selectedPreset.label}
              </span>
              {customPromptPreview && (
                <span className="max-w-[380px] truncate rounded-full border px-2.5 py-1">
                  Custom: {customPromptPreview}
                </span>
              )}
              {sourcePhoto?.alt && (
                <span className="truncate rounded-full border px-2.5 py-1">
                  {sourcePhoto.alt}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card/40 p-4">
                <Label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Original
                </Label>
                <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,_hsl(var(--muted)/0.4),_transparent_60%),linear-gradient(to_bottom,_hsl(var(--muted)/0.18),_hsl(var(--muted)/0.32))] p-5">
                  {sourceImageUrl ? (
                    <img
                      src={sourceImageUrl}
                      alt={sourcePhoto?.alt || 'Original'}
                      className="max-h-[420px] w-auto max-w-full rounded-md object-contain"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">Original image is not available.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-card/40 p-4">
                <Label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Enhanced
                </Label>
                <div className="relative flex min-h-[340px] items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_62%),linear-gradient(to_bottom,_hsl(var(--muted)/0.2),_hsl(var(--muted)/0.34))] p-5">
                  {resultImageUrl ? (
                    <img
                      src={resultImageUrl}
                      alt="Enhanced result"
                      className={cn(
                        'max-h-[420px] w-auto max-w-full rounded-md object-contain transition-opacity',
                        isEnhancing ? 'opacity-35' : 'opacity-100'
                      )}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground">Enhanced preview is not available.</div>
                  )}
                  {isEnhancing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/58 backdrop-blur-[1px]">
                      <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-sm text-foreground ring-1 ring-border/60">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Generating new preview...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t bg-background/95 px-7 py-4 sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Applying will add a new image to the gallery and replace the current slot.
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResultOpen(false)}
                disabled={isEnhancing || isApplying}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTryAgain}
                disabled={isEnhancing || isApplying}
              >
                {isEnhancing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try again
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={!resultImageUrl || isApplying}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
