-- Add support for storing full SVG content in canva_frames
-- This allows two storage modes:
-- 1. Simple frames: path + view_box columns
-- 2. Complex SVG: svg_content column with full SVG markup

ALTER TABLE public.canva_frames
ADD COLUMN IF NOT EXISTS frame_type TEXT DEFAULT 'simple' CHECK (frame_type IN ('simple', 'complex')),
ADD COLUMN IF NOT EXISTS svg_content TEXT;

-- Add comment to explain usage
COMMENT ON COLUMN public.canva_frames.frame_type IS 'simple = uses path+view_box, complex = uses svg_content';
COMMENT ON COLUMN public.canva_frames.svg_content IS 'Full SVG content for complex frames (used when frame_type=complex)';
