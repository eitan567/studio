-- Create a function to allow admins to update user roles
-- This function must be SECURITY DEFINER to bypass RLS and access auth.users
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role_id INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role INT;
  new_role_code TEXT;
  result JSONB;
BEGIN
  -- 1. Check if the executing user is an ADMIN
  SELECT role_id INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 1 THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can update roles.';
  END IF;

  -- 2. Validate the new role_id exists and get its code
  SELECT code INTO new_role_code
  FROM public.user_roles
  WHERE id = new_role_id;

  IF new_role_code IS NULL THEN
    RAISE EXCEPTION 'Invalid Role ID';
  END IF;

  -- 3. Update public.profiles
  UPDATE public.profiles
  SET role_id = new_role_id,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- 4. Update auth.users metadata (to keep them in sync)
  -- We use the supabase-specific feature to update user metadata via SQL if possible?
  -- Actually, standard SQL update on auth.users works if we have permissions (SECURITY DEFINER gives us that).
  -- We need to construct the new raw_app_meta_data.
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role_code)
  WHERE id = target_user_id;

  -- 5. Return success
  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'new_role', new_role_code
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (logic inside handles auth checks)
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, INT) TO authenticated;
