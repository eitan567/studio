import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Layout, Sparkles, Settings2 } from 'lucide-react';

interface LayoutSidebarLeftProps {
    onSave: () => void;
    onCancel: () => void;
}

export const LayoutSidebarLeft = ({ onSave, onCancel }: LayoutSidebarLeftProps) => {
    return (
        <div className="h-full z-20 flex bg-background">
            <div className="w-72 bg-background flex flex-col border-r shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-300">
                {/* Header */}
                <div className="p-4 border-b h-14 flex items-center justify-between bg-accent/5">
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                        <Layout className="w-4 h-4" /> Layout Tools
                    </h2>
                </div>

                {/* AI Generation Section */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            AI Generation
                        </Label>
                        <Button variant="outline" className="w-full gap-2" disabled>
                            <Sparkles className="h-4 w-4" />
                            Generate with AI
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Coming soon: Generate custom layout templates using AI.
                        </p>
                    </div>
                </div>

                {/* Empty State */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
                    <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                        <Settings2 className="w-6 h-6 opacity-20" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Layout Editor</p>
                        <p className="text-xs max-w-[180px]">Create and preview custom layout templates for your album pages.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
