-- Create User Roles Table
create table if not exists user_roles (
  id serial primary key,
  code text unique not null,
  description text
);

-- Seed Initial Roles
-- Seed Initial Roles (Commented out to allow seed.sql to handle this without conflict)
-- insert into user_roles (id, code, description) values
--   (1, 'ADMIN', 'Administrator with full access'),
--   (2, 'USER', 'Standard user'),
--   (3, 'GUEST', 'Guest user with limited access')
-- on conflict (id) do update set code = excluded.code;

-- Update Profiles with Role FK
alter table profiles add column if not exists role_id integer references user_roles(id) default 2;

-- Create index for performance
create index if not exists idx_profiles_role_id on profiles(role_id);
