create sequence "public"."template_classifications_id_seq";

drop index if exists "public"."idx_templates_type_id";

alter table if exists "public"."templates" drop constraint if exists "templates_pkey";

drop index if exists "public"."templates_pkey";


  create table "public"."template_classifications" (
    "id" integer not null default nextval('public.template_classifications_id_seq'::regclass),
    "code" text not null,
    "label" text
      );


alter table "public"."templates" add column "classification_type_id" integer;

alter table "public"."templates" add column "description" text;

alter table "public"."templates" alter column "created_by" drop default;

alter table "public"."templates" alter column "created_by" set data type uuid using "created_by"::uuid;

alter table "public"."templates" alter column "id" set data type integer using "id"::integer;

alter sequence "public"."template_classifications_id_seq" owned by "public"."template_classifications"."id";

CREATE INDEX idx_templates_classification_type_id ON public.templates USING btree (classification_type_id);

CREATE UNIQUE INDEX template_classifications_code_key ON public.template_classifications USING btree (code);

CREATE UNIQUE INDEX template_classifications_pkey ON public.template_classifications USING btree (id);

CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id);

alter table "public"."template_classifications" add constraint "template_classifications_pkey" PRIMARY KEY using index "template_classifications_pkey";

alter table "public"."template_classifications" add constraint "template_classifications_code_key" UNIQUE using index "template_classifications_code_key";

alter table "public"."templates" add constraint "templates_classification_type_id_fkey" FOREIGN KEY (classification_type_id) REFERENCES public.template_classifications(id) not valid;

alter table "public"."templates" validate constraint "templates_classification_type_id_fkey";

alter table "public"."templates" add constraint "templates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) not valid;

alter table "public"."templates" validate constraint "templates_created_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_role_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  role_code text;
begin
  select code into role_code from public.user_roles where id = new.role_id;
  
  if role_code is null then
    role_code := 'USER';
  end if;
  
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_role INT;
  new_role_code TEXT;
  result JSONB;
BEGIN
  SELECT role_id INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role != 1 THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can update roles.';
  END IF;

  SELECT code INTO new_role_code
  FROM public.user_roles
  WHERE id = new_role_id;

  IF new_role_code IS NULL THEN
    RAISE EXCEPTION 'Invalid Role ID';
  END IF;

  UPDATE public.profiles
  SET role_id = new_role_id,
      updated_at = NOW()
  WHERE id = target_user_id;

  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', new_role_code)
  WHERE id = target_user_id;

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
$function$
;

grant delete on table "public"."template_classifications" to "anon";

grant insert on table "public"."template_classifications" to "anon";

grant references on table "public"."template_classifications" to "anon";

grant select on table "public"."template_classifications" to "anon";

grant trigger on table "public"."template_classifications" to "anon";

grant truncate on table "public"."template_classifications" to "anon";

grant update on table "public"."template_classifications" to "anon";

grant delete on table "public"."template_classifications" to "authenticated";

grant insert on table "public"."template_classifications" to "authenticated";

grant references on table "public"."template_classifications" to "authenticated";

grant select on table "public"."template_classifications" to "authenticated";

grant trigger on table "public"."template_classifications" to "authenticated";

grant truncate on table "public"."template_classifications" to "authenticated";

grant update on table "public"."template_classifications" to "authenticated";

grant delete on table "public"."template_classifications" to "service_role";

grant insert on table "public"."template_classifications" to "service_role";

grant references on table "public"."template_classifications" to "service_role";

grant select on table "public"."template_classifications" to "service_role";

grant trigger on table "public"."template_classifications" to "service_role";

grant truncate on table "public"."template_classifications" to "service_role";

grant update on table "public"."template_classifications" to "service_role";


