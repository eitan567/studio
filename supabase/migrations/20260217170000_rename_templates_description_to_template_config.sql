-- Rename misused templates.description column to a semantic name.
-- This column stores template/editor configuration JSON payloads.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'templates'
      AND column_name = 'description'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'templates'
      AND column_name = 'template_config'
  ) THEN
    ALTER TABLE public.templates
      RENAME COLUMN description TO template_config;
  END IF;
END $$;
