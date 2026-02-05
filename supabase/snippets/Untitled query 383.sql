-- ========================================
-- Schema Only Migration Script
-- רק מבנה DB - ללא כל נתונים!
-- ========================================

-- הגדרות בסיסיות
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ========================================
-- 1. Extensions
-- ========================================

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- ========================================
-- 2. Functions
-- ========================================

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_role_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;

CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;

-- ========================================
-- 3. Tables
-- ========================================

CREATE TABLE IF NOT EXISTS "public"."albums" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Untitled Album'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "thumbnail_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "photos" "jsonb" DEFAULT '[]'::"jsonb"
);

CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "filename" "text" NOT NULL,
    "original_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "url" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "capture_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "album_id" "uuid",
    "user_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_id" integer DEFAULT 2
);

CREATE TABLE IF NOT EXISTS "public"."template_categories" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "label" "text"
);

CREATE TABLE IF NOT EXISTS "public"."template_types" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);

CREATE TABLE IF NOT EXISTS "public"."template_classifications" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "label" "text"
);

CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "photo_count" integer NOT NULL,
    "grid" "jsonb",
    "regions" "jsonb",
    "created_by" uuid,
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type_id" integer,
    "category_id" integer,
    "classification_type_id" integer,
    "description" text
);

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);

CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- ========================================
-- 4. Sequences
-- ========================================

CREATE SEQUENCE IF NOT EXISTS "public"."template_categories_id_seq"
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."template_types_id_seq"
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."template_classifications_id_seq"
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE SEQUENCE IF NOT EXISTS "public"."user_roles_id_seq"
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

-- קישור sequences לטבלאות
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_attrdef 
        WHERE adrelid = 'public.template_categories'::regclass 
        AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.template_categories'::regclass AND attname = 'id')
    ) THEN
        ALTER TABLE ONLY "public"."template_categories" 
        ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."template_categories_id_seq"'::"regclass");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attrdef 
        WHERE adrelid = 'public.template_types'::regclass 
        AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.template_types'::regclass AND attname = 'id')
    ) THEN
        ALTER TABLE ONLY "public"."template_types" 
        ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."template_types_id_seq"'::"regclass");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attrdef 
        WHERE adrelid = 'public.template_classifications'::regclass 
        AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.template_classifications'::regclass AND attname = 'id')
    ) THEN
        ALTER TABLE ONLY "public"."template_classifications" 
        ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."template_classifications_id_seq"'::"regclass");
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_attrdef 
        WHERE adrelid = 'public.user_roles'::regclass 
        AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.user_roles'::regclass AND attname = 'id')
    ) THEN
        ALTER TABLE ONLY "public"."user_roles" 
        ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");
    END IF;
END $$;

-- ========================================
-- 5. Primary Keys & Constraints
-- ========================================

DO $$
BEGIN
    -- albums
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_pkey') THEN
        ALTER TABLE ONLY "public"."albums" ADD CONSTRAINT "albums_pkey" PRIMARY KEY ("id");
    END IF;

    -- photos
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_pkey') THEN
        ALTER TABLE ONLY "public"."photos" ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");
    END IF;

    -- profiles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
        ALTER TABLE ONLY "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
    END IF;

    -- template_categories
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_categories_pkey') THEN
        ALTER TABLE ONLY "public"."template_categories" ADD CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_categories_code_key') THEN
        ALTER TABLE ONLY "public"."template_categories" ADD CONSTRAINT "template_categories_code_key" UNIQUE ("code");
    END IF;

    -- template_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_types_pkey') THEN
        ALTER TABLE ONLY "public"."template_types" ADD CONSTRAINT "template_types_pkey" PRIMARY KEY ("id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_types_code_key') THEN
        ALTER TABLE ONLY "public"."template_types" ADD CONSTRAINT "template_types_code_key" UNIQUE ("code");
    END IF;

    -- template_classifications
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_classifications_pkey') THEN
        ALTER TABLE ONLY "public"."template_classifications" ADD CONSTRAINT "template_classifications_pkey" PRIMARY KEY ("id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_classifications_code_key') THEN
        ALTER TABLE ONLY "public"."template_classifications" ADD CONSTRAINT "template_classifications_code_key" UNIQUE ("code");
    END IF;

    -- templates
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_pkey') THEN
        ALTER TABLE ONLY "public"."templates" ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");
    END IF;

    -- user_roles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_pkey') THEN
        ALTER TABLE ONLY "public"."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_code_key') THEN
        ALTER TABLE ONLY "public"."user_roles" ADD CONSTRAINT "user_roles_code_key" UNIQUE ("code");
    END IF;

    -- user_settings
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_pkey') THEN
        ALTER TABLE ONLY "public"."user_settings" ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");
    END IF;
END $$;

-- ========================================
-- 6. Indexes
-- ========================================

CREATE INDEX IF NOT EXISTS "idx_albums_user_id" ON "public"."albums" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_photos_capture_date" ON "public"."photos" USING "btree" ("capture_date");
CREATE INDEX IF NOT EXISTS "idx_profiles_role_id" ON "public"."profiles" USING "btree" ("role_id");
CREATE INDEX IF NOT EXISTS "idx_templates_active" ON "public"."templates" USING "btree" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_templates_category_id" ON "public"."templates" USING "btree" ("category_id");
CREATE INDEX IF NOT EXISTS "idx_templates_classification_type_id" ON "public"."templates" USING "btree" ("classification_type_id");

-- ========================================
-- 7. Foreign Keys
-- ========================================

DO $$
BEGIN
    -- albums -> auth.users
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."albums" 
        ADD CONSTRAINT "albums_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    -- photos -> auth.users
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."photos" 
        ADD CONSTRAINT "photos_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    -- profiles -> auth.users
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE ONLY "public"."profiles" 
        ADD CONSTRAINT "profiles_id_fkey" 
        FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    -- profiles -> user_roles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_id_fkey') THEN
        ALTER TABLE ONLY "public"."profiles" 
        ADD CONSTRAINT "profiles_role_id_fkey" 
        FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id");
    END IF;

    -- templates -> template_categories
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_category_id_fkey') THEN
        ALTER TABLE ONLY "public"."templates" 
        ADD CONSTRAINT "templates_category_id_fkey" 
        FOREIGN KEY ("category_id") REFERENCES "public"."template_categories"("id");
    END IF;

    -- templates -> template_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_type_id_fkey') THEN
        ALTER TABLE ONLY "public"."templates" 
        ADD CONSTRAINT "templates_type_id_fkey" 
        FOREIGN KEY ("type_id") REFERENCES "public"."template_types"("id");
    END IF;

    -- templates -> template_classifications
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_classification_type_id_fkey') THEN
        ALTER TABLE ONLY "public"."templates" 
        ADD CONSTRAINT "templates_classification_type_id_fkey" 
        FOREIGN KEY ("classification_type_id") REFERENCES "public"."template_classifications"("id");
    END IF;

    -- user_settings -> auth.users
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."user_settings" 
        ADD CONSTRAINT "user_settings_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ========================================
-- 8. Triggers
-- ========================================

DROP TRIGGER IF EXISTS "on_role_change" ON "public"."profiles";
CREATE TRIGGER "on_role_change" 
    AFTER INSERT OR UPDATE OF "role_id" ON "public"."profiles" 
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_role_update"();

-- ========================================
-- 9. Row Level Security Policies
-- ========================================

ALTER TABLE "public"."albums" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Albums policies
    DROP POLICY IF EXISTS "Users can view own albums" ON "public"."albums";
    CREATE POLICY "Users can view own albums" ON "public"."albums" FOR SELECT USING (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can insert own albums" ON "public"."albums";
    CREATE POLICY "Users can insert own albums" ON "public"."albums" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can update own albums" ON "public"."albums";
    CREATE POLICY "Users can update own albums" ON "public"."albums" FOR UPDATE USING (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can delete own albums" ON "public"."albums";
    CREATE POLICY "Users can delete own albums" ON "public"."albums" FOR DELETE USING (("auth"."uid"() = "user_id"));

    -- Photos policies
    DROP POLICY IF EXISTS "Public photos access" ON "public"."photos";
    CREATE POLICY "Public photos access" ON "public"."photos" FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Anyone can insert photos" ON "public"."photos";
    CREATE POLICY "Anyone can insert photos" ON "public"."photos" FOR INSERT WITH CHECK (true);

    DROP POLICY IF EXISTS "Users can insert own photos" ON "public"."photos";
    CREATE POLICY "Users can insert own photos" ON "public"."photos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can view own photos" ON "public"."photos";
    CREATE POLICY "Users can view own photos" ON "public"."photos" FOR SELECT USING (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can delete own photos" ON "public"."photos";
    CREATE POLICY "Users can delete own photos" ON "public"."photos" FOR DELETE USING (("auth"."uid"() = "user_id"));

    -- Profiles policies
    DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
    CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));

    DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."profiles";
    CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" 
    USING ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'ADMIN'::"text") OR ("auth"."uid"() = "id")));

    DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
    CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

    -- Templates policies
    DROP POLICY IF EXISTS "Anyone can read active templates" ON "public"."templates";
    CREATE POLICY "Anyone can read active templates" ON "public"."templates" FOR SELECT USING (("is_active" = true));

    DROP POLICY IF EXISTS "Service role can modify templates" ON "public"."templates";
    CREATE POLICY "Service role can modify templates" ON "public"."templates" USING (true) WITH CHECK (true);

    -- User settings policies
    DROP POLICY IF EXISTS "Users can view their own settings" ON "public"."user_settings";
    CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can insert their own settings" ON "public"."user_settings";
    CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can update their own settings" ON "public"."user_settings";
    CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));

    DROP POLICY IF EXISTS "Users can delete their own settings" ON "public"."user_settings";
    CREATE POLICY "Users can delete their own settings" ON "public"."user_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));
END $$;

-- ========================================
-- 10. Permissions
-- ========================================

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON ALL FUNCTIONS IN SCHEMA "public" TO "anon";
GRANT ALL ON ALL FUNCTIONS IN SCHEMA "public" TO "authenticated";
GRANT ALL ON ALL FUNCTIONS IN SCHEMA "public" TO "service_role";

GRANT ALL ON ALL TABLES IN SCHEMA "public" TO "anon";
GRANT ALL ON ALL TABLES IN SCHEMA "public" TO "authenticated";
GRANT ALL ON ALL TABLES IN SCHEMA "public" TO "service_role";

GRANT ALL ON ALL SEQUENCES IN SCHEMA "public" TO "anon";
GRANT ALL ON ALL SEQUENCES IN SCHEMA "public" TO "authenticated";
GRANT ALL ON ALL SEQUENCES IN SCHEMA "public" TO "service_role";

-- ========================================
-- ✅ DONE - Schema Only!
-- ========================================
-- אין שום INSERT - רק מבנה DB