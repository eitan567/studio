-- Add role column to profiles table for admin functionality
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' 
CHECK (role IN ('user', 'admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Set existing users as admin (for development)
UPDATE public.profiles SET role = 'admin' WHERE role = 'user';
