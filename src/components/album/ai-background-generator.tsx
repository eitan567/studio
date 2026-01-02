'use client';

import React, { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { aiGenerateBackground } from '@/ai/ai-generate-background';

interface AiBackgroundGeneratorProps {
    onBackgroundGenerated: (imageUrl: string) => void;
}

export function AiBackgroundGenerator({ onBackgroundGenerated }: AiBackgroundGeneratorProps) {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const result = await aiGenerateBackground({ prompt });
            if (result.success && result.imageUrl) {
                onBackgroundGenerated(result.imageUrl);
                setPrompt('');
                toast({
                    title: 'Background Generated!',
                    description: 'AI background has been added to your options.',
                });
            } else {
                toast({
                    title: 'Generation Failed',
                    description: result.error || 'Could not generate background. Try a different prompt.',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to generate background. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-2 pt-2 border-t">
            <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generate with AI
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Describe background..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="flex-1 h-8 px-2 text-sm border rounded"
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGenerate();
                    }}
                />
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={isGenerating || !prompt.trim()}
                    onClick={handleGenerate}
                >
                    {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Wand2 className="w-4 h-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}
