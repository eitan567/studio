-- Create a function to handle role updates
CREATE OR REPLACE FUNCTION public.handle_role_update() 
RETURNS TRIGGER AS $$
BEGIN
  -- Update the auth.users table with the new role in app_metadata
  UPDATE auth.users
  SET raw_app_meta_data = 
    jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role)
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_role_change ON public.profiles;
CREATE TRIGGER on_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_role_update();

-- One-time backfill for existing users
-- This ensures current admins get the metadata set immediately
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id, role FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(user_record.role)
      )
    WHERE id = user_record.id;
  END LOOP;
END;
$$;
