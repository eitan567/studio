-- Add support for complex SVG frames with full SVG content
-- This migration only ADDS columns, does not modify or delete anything

-- Add frame_type column to distinguish simple (path-only) from complex (full SVG) frames
ALTER TABLE public.canva_frames 
ADD COLUMN IF NOT EXISTS frame_type TEXT NOT NULL DEFAULT 'simple';

-- Add svg_content column to store full SVG markup for complex frames
ALTER TABLE public.canva_frames 
ADD COLUMN IF NOT EXISTS svg_content TEXT;

-- Add constraint to validate frame_type values
ALTER TABLE public.canva_frames
ADD CONSTRAINT valid_frame_type CHECK (frame_type IN ('simple', 'complex'));

-- Add comment explaining the fields
COMMENT ON COLUMN public.canva_frames.frame_type IS 'Type of frame: simple (uses path+view_box) or complex (uses svg_content)';
COMMENT ON COLUMN public.canva_frames.svg_content IS 'Full SVG markup for complex frames with multiple paths, colors, gradients, etc.';

-- Create index for faster filtering by frame type
CREATE INDEX IF NOT EXISTS idx_canva_frames_type ON public.canva_frames(frame_type);
