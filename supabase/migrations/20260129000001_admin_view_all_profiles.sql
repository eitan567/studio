-- Allow Admins to see all profiles
-- Current policies only allow viewing own profile.

-- Drop existing overlapping policy if it exists (though "Users can view own profile" is fine to keep, we just add a broader one)
-- Actually, let's create a new policy "Admins can view all profiles".

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role_id = 1
  )
);
