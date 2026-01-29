-- Fix RLS Recursion by using JWT claims instead of querying the table
-- Previous policy "Admins can view all profiles" caused infinite recursion.

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'ADMIN'
  OR
  auth.uid() = id
);
