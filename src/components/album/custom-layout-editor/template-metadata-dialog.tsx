
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AdvancedTemplate } from '@/lib/advanced-layout-types';
import { createClient } from '@/lib/supabase';
import { invalidateCache } from '@/lib/templates-cache';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/hooks/useTemplates';

interface TemplateMetadataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: AdvancedTemplate | null;
    onSaveSuccess: () => void;
    onUpdateLocalTemplate?: (templateId: string | number, updates: Partial<AdvancedTemplate>) => void;
}

export const TemplateMetadataDialog = ({
    open,
    onOpenChange,
    template,
    onSaveSuccess,
    onUpdateLocalTemplate
}: TemplateMetadataDialogProps) => {
    const { toast } = useToast();
    const { templateTypes, templateCategories, templateClassifications } = useTemplates();

    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Store IDs directly
    const [typeId, setTypeId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [classificationId, setClassificationId] = useState<string>('');

    // Initialize form when template changes
    useEffect(() => {
        if (template && open) {
            setName(template.name || '');

            setIsActive(template.is_active !== false);

            // Set Initial IDs
            if (template.type_id) setTypeId(String(template.type_id));
            if (template.category_id) setCategoryId(String(template.category_id));
            if (template.classification_type_id) setClassificationId(String(template.classification_type_id));

            // Fallback for classification if only type string exists (old behavior)
            if (!template.classification_type_id && template.type) {
                // Try to find matching classification by code
                const match = templateClassifications.find(c => c.code.toLowerCase() === template.type?.toLowerCase());
                if (match) setClassificationId(String(match.id));
            }
        }
    }, [template, open, templateClassifications]);

    const handleSave = async () => {
        if (!template) return;
        setIsLoading(true);

        try {
            const updateData = {
                name: name,
                type_id: typeId ? parseInt(typeId) : null,
                category_id: categoryId ? parseInt(categoryId) : null,
                classification_type_id: classificationId ? parseInt(classificationId) : null,
                is_active: isActive,
                updated_at: new Date().toISOString()
            };

            const isUnsavedLocalTemplate =
                typeof template.id === 'string' && template.id.includes('-');

            if (isUnsavedLocalTemplate) {
                onUpdateLocalTemplate?.(template.id, updateData);
                toast({
                    title: "Success",
                    description: "Template metadata updated locally. Save Template to persist.",
                });
                onSaveSuccess();
                onOpenChange(false);
                return;
            }

            const supabase = createClient();

            const { error } = await supabase
                .from('templates')
                .update(updateData)
                .eq('id', template.id);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Template updated successfully",
            });

            // Force cache refresh
            await invalidateCache();

            onSaveSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Failed to update template:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: 'Failed to update template: ' + (error?.message || 'Unknown error'),
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] z-[100]">
                <DialogHeader>
                    <DialogTitle>Edit Template Metadata</DialogTitle>
                    <DialogDescription>
                        Update the properties of this template.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>


                    {/* Classification (Renamed from Type) */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="classification" className="text-right">
                            Classification
                        </Label>
                        <Select value={classificationId} onValueChange={setClassificationId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select classification" />
                            </SelectTrigger>
                            <SelectContent className="z-[101]">
                                {templateClassifications.map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                            Category
                        </Label>
                        <Select value={categoryId} onValueChange={setCategoryId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent className="z-[101]">
                                {templateCategories.map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Type (Real Type) */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <Select value={typeId} onValueChange={setTypeId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent className="z-[101]">
                                {templateTypes.map((item) => (
                                    <SelectItem key={item.id} value={String(item.id)}>
                                        {item.description || item.code}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="active" className="text-right">
                            Active
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
                            <Label htmlFor="active" className="font-normal text-muted-foreground">
                                {isActive ? 'Visible in library' : 'Hidden from library'}
                            </Label>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
