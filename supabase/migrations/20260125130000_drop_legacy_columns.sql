-- Drop legacy text columns
alter table templates drop column if exists type;
alter table templates drop column if exists category;

-- Drop code columns if they still exist (previously attempted)
alter table templates drop column if exists type_code;
alter table templates drop column if exists category_code;
