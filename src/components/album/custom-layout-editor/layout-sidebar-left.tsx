import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Layout } from 'lucide-react';

interface LayoutSidebarLeftProps {
    onSave: () => void;
    onCancel: () => void;
}

export const LayoutSidebarLeft = ({ onSave, onCancel }: LayoutSidebarLeftProps) => {
    return (
        <div className="w-16 border-r bg-background flex flex-col items-center py-4 gap-4 shrink-0">
            {/* Logo / Title Area */}
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layout className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1" />

            {/* Bottom Actions */}
            <div className="flex flex-col gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-lg text-destructive hover:bg-destructive/10"
                    onClick={onCancel}
                    title="Cancel"
                >
                    <X className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-lg text-green-600 hover:bg-green-600/10"
                    onClick={onSave}
                    title="Save"
                >
                    <Check className="h-5 w-5" />
                </Button>
            </div>
        </div>
    );
};
