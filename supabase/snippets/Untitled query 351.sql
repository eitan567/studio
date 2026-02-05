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