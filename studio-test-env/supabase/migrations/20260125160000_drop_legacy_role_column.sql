-- 1. Drop dependencies of the legacy 'role' column
drop trigger if exists on_role_change on public.profiles;
drop function if exists public.handle_role_update();

-- 2. Drop the legacy text column
alter table public.profiles drop column if exists role;

-- 3. Re-create the sync function to work with 'role_id' and 'user_roles'
create or replace function public.handle_role_update() 
returns trigger as $$
declare
  role_code text;
begin
  -- Lookup the text code (ADMIN, USER, GUEST) from the FK
  select code into role_code from public.user_roles where id = new.role_id;

  -- Default to USER if something breaks
  if role_code is null then
    role_code := 'USER';
  end if;

  -- Update auth.users metadata
  update auth.users
  set raw_app_meta_data = 
    jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(role_code)
    )
  where id = new.id;
  
  return new;
end;
$$ language plpgsql security definer;

-- 4. Re-attach trigger to 'role_id'
create trigger on_role_change
  after insert or update of role_id on public.profiles
  for each row
  execute function public.handle_role_update();
