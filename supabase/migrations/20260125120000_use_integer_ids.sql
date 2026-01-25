-- Re-create Types Table with ID
drop table if exists template_types cascade;
create table template_types (
  id serial primary key,
  code text unique not null,
  description text
);

-- Re-create Categories Table with ID
drop table if exists template_categories cascade;
create table template_categories (
  id serial primary key,
  code text unique not null,
  label text
);

-- Update Templates Table
-- Drop old code columns if they exist
alter table templates drop column if exists type_code;
alter table templates drop column if exists category_code;

-- Add new ID columns
alter table templates add column type_id integer references template_types(id);
alter table templates add column category_id integer references template_categories(id);

-- Optional: Create index for performance
create index if not exists idx_templates_type_id on templates(type_id);
create index if not exists idx_templates_category_id on templates(category_id);
