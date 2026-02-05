-- Migration: Add template classifications system
-- Created: 2026-02-05

-- 1. Create template_classifications table
CREATE TABLE IF NOT EXISTS public.template_classifications (
    id integer PRIMARY KEY,
    code text UNIQUE NOT NULL,
    label text
);

ALTER TABLE public.template_classifications OWNER TO postgres;

-- 2. Seed classifications
INSERT INTO public.template_classifications (id, code, label) VALUES
    (1, 'SINGLE', 'Single Page'),
    (2, 'SPREAD', 'Double Page Spread'),
    (3, 'BOTH', 'Both')
ON CONFLICT (id) DO NOTHING;

-- 3. Add classification_type_id to templates
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS classification_type_id integer;

-- 4. Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'templates_classification_type_id_fkey'
    ) THEN
        ALTER TABLE public.templates 
        ADD CONSTRAINT templates_classification_type_id_fkey 
        FOREIGN KEY (classification_type_id) REFERENCES public.template_classifications(id);
    END IF;
END $$;

-- 5. Initial data migration: Default existing templates
-- System templates are usually spreads
UPDATE public.templates SET classification_type_id = 2 WHERE created_by = 'system';

-- Custom templates - try to guess from description JSON if exists
UPDATE public.templates SET classification_type_id = 1 WHERE description LIKE '%"type":"single"%';
UPDATE public.templates SET classification_type_id = 2 WHERE description LIKE '%"type":"spread"%';
UPDATE public.templates SET classification_type_id = 3 WHERE description LIKE '%"type":"both"%';

-- Default remainder to SINGLE if not set (to avoid NULLs if required)
UPDATE public.templates SET classification_type_id = 1 WHERE classification_type_id IS NULL;

-- 6. Update existing type codes if they were text in a previous (my) failed attempt
-- We are removing the 'type' text column if I added it previously (clean up)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='type' AND data_type='text') THEN
        ALTER TABLE public.templates DROP COLUMN type;
    END IF;
END $$;
