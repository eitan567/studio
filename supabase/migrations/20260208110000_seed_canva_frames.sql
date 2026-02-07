-- Seed canva_frames table with sample data from CANVA_TEMPLATES
-- This inserts individual frame shapes, not full templates

-- Simple frames (path + view_box only)
INSERT INTO public.canva_frames (name, path, view_box, category, frame_type, is_public)
VALUES
-- Simple rectangular frame
('Simple Rectangle', 'M 164.121094 20 L 699.878906 20 L 699.878906 844 L 164.121094 844 Z M 164.121094 20', '164.121094 20.0 535.7578120000001 824.0', 'basic', 'simple', true),

-- Rounded rectangle
('Rounded Rectangle', 'M 248.015625 100.269531 L 616 100.269531 L 616 764 L 248.015625 764 Z M 248.015625 100.269531', '248.015625 100.269531 367.984375 663.730469', 'basic', 'simple', true),

-- Portrait frame
('Portrait Frame', 'M 235.269531 29 L 629 29 L 629 834.617188 L 235.269531 834.617188 Z M 235.269531 29', '235.269531 29.0 393.73046899999997 805.617188', 'basic', 'simple', true),

-- Landscape frame
('Landscape Frame', 'M 191 36 L 673 36 L 673 827.738281 L 191 827.738281 Z M 191 36', '191.0 36.0 482.0 791.738281', 'basic', 'simple', true),

-- Square frame
('Square Frame', 'M 0.875 0.511719 L 610.625 0.511719 L 610.625 619.261719 L 0.875 619.261719 Z M 0.875 0.511719', '0.875 0.511719 609.75 618.75', 'basic', 'simple', true);

-- Complex decorative frames (would use svg_content in the future)
-- For now, adding a few more interesting path shapes
INSERT INTO public.canva_frames (name, path, view_box, category, frame_type, is_public)
VALUES
-- Artboard shape (notebook/paper look)
('Paper Stack', 'M1171.44,721.41c13.34-.93,26.8-1.06,40-3,33-4.76,51.32-25.62,51.37-57.15,0-33.24-15.66-51.78-49.31-58.4-15.61-3.07-31.17-6.34-46.72-9.66-.75-.16-1.2-1.72-4.08-6.2,22.15-2.74,42.58-5.46,63.07-7.76,37.15-4.16,56.1-22.19,57.38-55,1.4-35.78-15.36-54.88-54.43-61.39-41-6.84-82.06-13.33-125.48-20.36', '231.76999999999998 261.38000000000005 1549.7200000000005 1479.48', 'decorative', 'simple', true),

-- Organic blob shape
('Blob Frame', 'M1678,1567.52l40.07-171.76c-93.31-25.11-187.73-38.06-281.87-57.75,115.8-22,232-39.47,347.53-71.07-20.22-90.11-40-178.18-60.42-269.22', '216.28000000000006 432.0099999999999 1567.4499999999998 1135.5100000000002', 'organic', 'simple', true),

-- Peanut/organic shape
('Organic Peanut', 'M1512.15,1009.41c-6.2,49.51,2.84,96.1,28.86,139.32q22.11,36.7,41.79,74.89a194,194,0,0,1,21.77,86.41c.7,38.07-9.63,72.6-33.57,102.69', '372.6700000000003 109.48 1254.58 1819.3300000000002', 'organic', 'simple', true);

-- Add index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_canva_frames_category ON public.canva_frames(category);
CREATE INDEX IF NOT EXISTS idx_canva_frames_frame_type ON public.canva_frames(frame_type);
