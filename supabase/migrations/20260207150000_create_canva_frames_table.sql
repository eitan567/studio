-- Create canva_frames table for storing SVG frame shapes
-- This is a NEW table, does not modify any existing tables

CREATE TABLE IF NOT EXISTS public.canva_frames (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,                    -- SVG path data (d attribute)
    view_box TEXT NOT NULL DEFAULT '0 0 100 100',  -- SVG viewBox attribute
    category TEXT DEFAULT 'general',       -- Category for organization (hearts, clouds, stars, etc.)
    is_public BOOLEAN DEFAULT true,        -- Whether frame is publicly available
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.canva_frames ENABLE ROW LEVEL SECURITY;

-- Everyone can view public frames (even unauthenticated)
CREATE POLICY "Public frames are viewable by everyone"
    ON public.canva_frames
    FOR SELECT
    USING (is_public = true);

-- Authenticated users can view all frames
CREATE POLICY "Authenticated users can view frames"
    ON public.canva_frames
    FOR SELECT
    TO authenticated
    USING (true);

-- Admins can manage frames (insert, update, delete) - role_id = 1 is ADMIN
CREATE POLICY "Admins can manage frames"
    ON public.canva_frames
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role_id = 1
        )
    );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_canva_frames_category ON public.canva_frames(category);
CREATE INDEX IF NOT EXISTS idx_canva_frames_public ON public.canva_frames(is_public);

-- Add comment
COMMENT ON TABLE public.canva_frames IS 'Stores SVG frame shapes for the custom layout editor';
