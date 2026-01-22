-- Ensure the 'photos' bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload (INSERT) to 'photos' bucket
-- Note: We check that the folder path starts with their user ID to prevent overwriting others' files
-- Assuming path structure: user_id/filename
CREATE POLICY "Allow Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public to view (SELECT) files in 'photos' bucket
CREATE POLICY "Allow Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'photos' );

-- Policy: Allow users to UPDATE their own files
CREATE POLICY "Allow User Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'photos' AND owner = auth.uid() )
WITH CHECK ( bucket_id = 'photos' AND owner = auth.uid() );

-- Policy: Allow users to DELETE their own files
CREATE POLICY "Allow User Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'photos' AND owner = auth.uid() );
