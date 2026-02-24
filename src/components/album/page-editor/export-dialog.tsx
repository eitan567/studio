'use client';

import React, { useState } from 'react';
import { Download, FileImage, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExportDpi } from '../shared/album-exporter';

export interface ExportOptions {
    format: 'images' | 'pdf';
    pageRange: 'all' | 'cover' | 'singles' | { from: number; to: number };
    dpi: ExportDpi;
}

interface ExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    totalPages: number;
    onConfirm: (options: ExportOptions) => void;
    isExporting: boolean;
    exportProgress: { current: number; total: number; label?: string } | null;
}

export function ExportDialog({
    open,
    onOpenChange,
    totalPages,
    onConfirm,
    isExporting,
    exportProgress,
}: ExportDialogProps) {
    const [format, setFormat] = useState<'images' | 'pdf'>('pdf');
    const [dpi, setDpi] = useState<ExportDpi>(300);
    const [rangeMode, setRangeMode] = useState<'all' | 'cover' | 'singles' | 'range'>('all');
    const [fromPage, setFromPage] = useState(1);
    const [toPage, setToPage] = useState(totalPages);

    const progressPct = exportProgress
        ? Math.round((exportProgress.current / exportProgress.total) * 100)
        : 0;

    const isComplete = exportProgress && exportProgress.current >= exportProgress.total;

    const handleConfirm = () => {
        const options: ExportOptions = {
            format,
            dpi,
            pageRange:
                rangeMode === 'all' || rangeMode === 'cover' || rangeMode === 'singles'
                    ? rangeMode
                    : {
                        from: Math.max(1, Math.min(fromPage, toPage)),
                        to: Math.min(totalPages, Math.max(fromPage, toPage)),
                    },
        };
        onConfirm(options);
    };

    // When exporting: show progress overlay instead of settings
    if (isExporting) {
        return (
            <Dialog open={open} onOpenChange={() => { }} /* non-dismissable while exporting */>
                <DialogContent
                    className="sm:max-w-md [&>button]:hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {isComplete ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            )}
                            {isComplete
                                ? 'Export Complete'
                                : `Exporting to ${format === 'pdf' ? 'PDF' : 'Images'}...`}
                        </DialogTitle>
                        <DialogDescription>
                            {isComplete
                                ? 'Your download should start shortly.'
                                : 'Please wait while your album is being exported. Do not close this window.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <Progress value={progressPct} className="h-3" />
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                {exportProgress?.label ||
                                    (exportProgress
                                        ? `Page ${exportProgress.current} of ${exportProgress.total}`
                                        : 'Preparing...')}
                            </span>
                            <span className="font-semibold tabular-nums">{progressPct}%</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Export Album
                    </DialogTitle>
                    <DialogDescription>
                        Choose your export format and which pages to include.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Format selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Format</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setFormat('pdf')}
                                className={cn(
                                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all text-left',
                                    format === 'pdf'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-muted-foreground/40'
                                )}
                            >
                                <FileText className={cn('h-6 w-6', format === 'pdf' ? 'text-primary' : 'text-muted-foreground')} />
                                <div>
                                    <div className="font-medium text-sm">PDF</div>
                                    <div className="text-xs text-muted-foreground">Single file, all pages</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('images')}
                                className={cn(
                                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all text-left',
                                    format === 'images'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-muted-foreground/40'
                                )}
                            >
                                <FileImage className={cn('h-6 w-6', format === 'images' ? 'text-primary' : 'text-muted-foreground')} />
                                <div>
                                    <div className="font-medium text-sm">Images (ZIP)</div>
                                    <div className="text-xs text-muted-foreground">High-res PNG files</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Resolution selection */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Resolution</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 150 as ExportDpi, label: '150 DPI', hint: 'Fast' },
                                { value: 200 as ExportDpi, label: '200 DPI', hint: 'Balanced' },
                                { value: 300 as ExportDpi, label: '300 DPI', hint: 'Print' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setDpi(option.value)}
                                    className={cn(
                                        'rounded-md border px-3 py-2 text-left transition-all',
                                        dpi === option.value
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border hover:border-muted-foreground/40'
                                    )}
                                >
                                    <div className="text-sm font-medium">{option.label}</div>
                                    <div className="text-[11px] text-muted-foreground">{option.hint}</div>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Applied to PNG export, PDF export, and page download quality.
                        </p>
                    </div>

                    {/* Page range */}
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold">Pages</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="range"
                                    checked={rangeMode === 'all'}
                                    onChange={() => setRangeMode('all')}
                                    className="accent-primary"
                                />
                                <span className="text-sm">All pages ({totalPages} total)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="range"
                                    checked={rangeMode === 'cover'}
                                    onChange={() => setRangeMode('cover')}
                                    className="accent-primary"
                                />
                                <span className="text-sm">Cover only</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="range"
                                    checked={rangeMode === 'singles'}
                                    onChange={() => setRangeMode('singles')}
                                    className="accent-primary"
                                />
                                <span className="text-sm">Single pages only</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="range"
                                    checked={rangeMode === 'range'}
                                    onChange={() => setRangeMode('range')}
                                    className="accent-primary"
                                />
                                <span className="text-sm">Page range</span>
                            </label>
                        </div>

                        {rangeMode === 'range' && (
                            <div className="flex items-center gap-3 pl-6">
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={totalPages}
                                        value={fromPage}
                                        onChange={(e) => setFromPage(Number(e.target.value))}
                                        className="h-8 w-20 text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={totalPages}
                                        value={toPage}
                                        onChange={(e) => setToPage(Number(e.target.value))}
                                        className="h-8 w-20 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="pt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
