


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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_role_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_role_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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


ALTER TABLE "public"."albums" OWNER TO "postgres";


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


ALTER TABLE "public"."photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_id" integer DEFAULT 2
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_categories" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "label" "text"
);


ALTER TABLE "public"."template_categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."template_categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."template_categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."template_categories_id_seq" OWNED BY "public"."template_categories"."id";



CREATE TABLE IF NOT EXISTS "public"."template_types" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."template_types" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."template_types_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."template_types_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."template_types_id_seq" OWNED BY "public"."template_types"."id";



CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "photo_count" integer NOT NULL,
    "grid" "jsonb",
    "regions" "jsonb",
    "created_by" "text" DEFAULT 'system'::"text",
    "is_system" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "type_id" integer,
    "category_id" integer
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."templates" IS 'Layout templates for album pages - cached in application memory';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_roles_id_seq" OWNED BY "public"."user_roles"."id";



CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."template_categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."template_categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."template_types" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."template_types_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_categories"
    ADD CONSTRAINT "template_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."template_categories"
    ADD CONSTRAINT "template_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_types"
    ADD CONSTRAINT "template_types_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."template_types"
    ADD CONSTRAINT "template_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "idx_albums_user_id" ON "public"."albums" USING "btree" ("user_id");



CREATE INDEX "idx_photos_capture_date" ON "public"."photos" USING "btree" ("capture_date");



CREATE INDEX "idx_profiles_role_id" ON "public"."profiles" USING "btree" ("role_id");



CREATE INDEX "idx_templates_active" ON "public"."templates" USING "btree" ("is_active");



CREATE INDEX "idx_templates_category_id" ON "public"."templates" USING "btree" ("category_id");



CREATE INDEX "idx_templates_type_id" ON "public"."templates" USING "btree" ("type_id");



CREATE OR REPLACE TRIGGER "on_role_change" AFTER INSERT OR UPDATE OF "role_id" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_role_update"();



ALTER TABLE ONLY "public"."albums"
    ADD CONSTRAINT "albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."user_roles"("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."template_categories"("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."template_types"("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((((("auth"."jwt"() -> 'app_metadata'::"text") ->> 'role'::"text") = 'ADMIN'::"text") OR ("auth"."uid"() = "id")));



CREATE POLICY "Anyone can insert photos" ON "public"."photos" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read active templates" ON "public"."templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public photos access" ON "public"."photos" FOR SELECT USING (true);



CREATE POLICY "Service role can modify templates" ON "public"."templates" USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete own albums" ON "public"."albums" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own photos" ON "public"."photos" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own settings" ON "public"."user_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own albums" ON "public"."albums" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own photos" ON "public"."photos" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own albums" ON "public"."albums" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own albums" ON "public"."albums" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own photos" ON "public"."photos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."albums" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_role_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_role_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_role_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role"("target_user_id" "uuid", "new_role_id" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."albums" TO "anon";
GRANT ALL ON TABLE "public"."albums" TO "authenticated";
GRANT ALL ON TABLE "public"."albums" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."template_categories" TO "anon";
GRANT ALL ON TABLE "public"."template_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."template_categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."template_categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."template_categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."template_categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."template_types" TO "anon";
GRANT ALL ON TABLE "public"."template_types" TO "authenticated";
GRANT ALL ON TABLE "public"."template_types" TO "service_role";



GRANT ALL ON SEQUENCE "public"."template_types_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."template_types_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."template_types_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict YHIOLeCcVsEPgH5BlkfKceI3NVO7snKg81NDE7LP1lPikwiDMjqlH0E8ie6gV2s

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', 'f236ec19-0fed-4f7e-8612-be69fb73a5a5', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-29 09:36:28.278749+00', ''),
	('00000000-0000-0000-0000-000000000000', '1edc6d32-17f2-4007-8eed-9a5343cf9d6a', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-29 09:43:39.371989+00', ''),
	('00000000-0000-0000-0000-000000000000', '23933cdc-9b9a-4daa-b9ea-a9baa178920b', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-29 09:52:45.644468+00', ''),
	('00000000-0000-0000-0000-000000000000', '99b08b4a-ccf9-403d-b2fa-b6271520a8ef', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-29 09:53:06.836332+00', ''),
	('00000000-0000-0000-0000-000000000000', '03c34fe8-0644-4cf6-8bbd-e52d8c898f09', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-01-29 10:09:14.582702+00', ''),
	('00000000-0000-0000-0000-000000000000', '055d96b1-5c50-4fac-9283-9b04b05f092e', '{"action":"login","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2026-01-29 10:09:55.923921+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b9914143-fd3b-428c-9ea9-a605f7fd69fa', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 14:12:07.467676+00', ''),
	('00000000-0000-0000-0000-000000000000', '272d2282-1b45-4052-87a1-f1da7b36404b', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 14:12:07.46874+00', ''),
	('00000000-0000-0000-0000-000000000000', '7b4fe2a0-49f5-4387-8dea-8989bc36a424', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 15:11:15.731647+00', ''),
	('00000000-0000-0000-0000-000000000000', '736ee94b-5e3b-4b60-acec-8c85054e065a', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 15:11:15.732034+00', ''),
	('00000000-0000-0000-0000-000000000000', '6e6d7242-c77d-45b2-8030-1fcd5a8148df', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 16:37:03.696679+00', ''),
	('00000000-0000-0000-0000-000000000000', '4777a542-9995-40de-8f81-2e6a219973be', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 16:37:03.69726+00', ''),
	('00000000-0000-0000-0000-000000000000', '4d9be49e-d8a3-4c98-aa52-83518f51797f', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 17:35:37.950283+00', ''),
	('00000000-0000-0000-0000-000000000000', '68646479-881b-4ab3-b69d-8c2ddf19b6e4', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 17:35:37.950891+00', ''),
	('00000000-0000-0000-0000-000000000000', '713358fc-e0e1-4192-8f02-3bfc7f9b21d8', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 18:33:38.410358+00', ''),
	('00000000-0000-0000-0000-000000000000', '414e4d76-0460-4914-9d86-25e4f002e8c7', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 18:33:38.410849+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f3212998-38b3-4b48-ba21-a06efc989b2d', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 19:53:04.934392+00', ''),
	('00000000-0000-0000-0000-000000000000', 'aebca902-2dc5-4f3d-a2ee-e853cd7bac59', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 19:53:04.935118+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c20614db-30e7-40e3-a4c1-065cf6813cc6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 20:54:38.072634+00', ''),
	('00000000-0000-0000-0000-000000000000', '687ea0a7-b362-424e-9f87-b8280052ee9d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 20:54:38.073117+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd26c0b88-f149-4e54-9bfa-2784dc0d3cb6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 21:53:05.188759+00', ''),
	('00000000-0000-0000-0000-000000000000', '0a38d7f0-4a97-45de-b99b-3744cf53fdfb', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-30 21:53:05.189284+00', ''),
	('00000000-0000-0000-0000-000000000000', '4de4fd07-9ef4-4c79-9a4e-4daa91a357f5', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 05:58:50.30598+00', ''),
	('00000000-0000-0000-0000-000000000000', '18653837-ae9e-466c-95c3-e48976849baa', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 05:58:50.307116+00', ''),
	('00000000-0000-0000-0000-000000000000', 'aeed87a7-0dcf-416d-a80a-441f78136d0a', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 07:06:05.465832+00', ''),
	('00000000-0000-0000-0000-000000000000', '496c9a05-fc1f-4e59-83c0-37aee5993243', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 07:06:05.466309+00', ''),
	('00000000-0000-0000-0000-000000000000', '192d0af6-8d2d-4ac1-b17e-415c1f1a97e6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 08:07:10.37319+00', ''),
	('00000000-0000-0000-0000-000000000000', '433ede08-13e4-42db-9b26-dd7ad3ec5453', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 08:07:10.37383+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dff7cceb-106a-4b8a-95c6-22783a83ecd2', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 09:18:52.993416+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e2610ea0-ee3d-4311-a388-8c7567634ee8', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 09:18:52.993997+00', ''),
	('00000000-0000-0000-0000-000000000000', '696fa843-1468-4108-90d4-39378c458662', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 10:16:55.349169+00', ''),
	('00000000-0000-0000-0000-000000000000', '8589835e-45bf-4d7a-9b07-f9088914ecbe', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 10:16:55.350272+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a9e5b364-bb16-4be7-82aa-71f48a69816d', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 11:16:32.725356+00', ''),
	('00000000-0000-0000-0000-000000000000', '2916cc5c-6098-49e5-95cc-4756d0bcafee', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 11:16:32.726209+00', ''),
	('00000000-0000-0000-0000-000000000000', '3a04938a-64c8-498f-9f5f-90611df7271e', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 14:08:16.189682+00', ''),
	('00000000-0000-0000-0000-000000000000', '978c3684-d770-4c68-b93c-918e8437d543', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 14:08:16.190199+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd64f4687-e4f0-43c5-8e8a-b69f5289c63d', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 16:07:47.238465+00', ''),
	('00000000-0000-0000-0000-000000000000', '3ea09e49-8e87-4fff-aa2e-15bcd2a90944', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 16:07:47.238983+00', ''),
	('00000000-0000-0000-0000-000000000000', '93803d13-631d-4b1f-9611-396a92cfa5c9', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 20:50:27.089792+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cc0b3741-c7f2-4104-93bf-e50eef4ab05a', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 20:50:27.090296+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fc238e21-9937-4910-8cda-b0bd0b1ed153', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 21:48:47.497496+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a5d7aaba-bb19-4d77-8053-d614fa5e18f9', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 21:48:47.497969+00', ''),
	('00000000-0000-0000-0000-000000000000', '028f049a-b4bc-4471-824e-7cebfe9728b8', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 22:46:47.133096+00', ''),
	('00000000-0000-0000-0000-000000000000', '9ca6a790-52f7-4c26-9d09-8a876ae2c137', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 22:46:47.133545+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b8fb98dd-429f-40d6-ae35-dcbdbbc8771c', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 23:44:47.124242+00', ''),
	('00000000-0000-0000-0000-000000000000', '552a7a02-db0e-4970-9096-171f8637b89e', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-01-31 23:44:47.124719+00', ''),
	('00000000-0000-0000-0000-000000000000', '70364763-d286-4259-8138-e4218722e1d2', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 00:42:47.129551+00', ''),
	('00000000-0000-0000-0000-000000000000', '7f3ada25-2928-42a6-8ea6-05cf79885b63', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 00:42:47.130014+00', ''),
	('00000000-0000-0000-0000-000000000000', '2027d424-0eb2-4382-ac00-ef49318f141b', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 01:40:47.126942+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cf826692-ba99-4820-aad1-1be462b916d8', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 01:40:47.127427+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f6f2d074-5d7f-49ce-a343-21e480ac86dd', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 02:38:47.159507+00', ''),
	('00000000-0000-0000-0000-000000000000', '1eaa15a1-e0a9-42e4-bbe2-a7f19e9bc17c', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 02:38:47.160056+00', ''),
	('00000000-0000-0000-0000-000000000000', '69027eea-6538-4c39-ae8d-7207657cd9e6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 03:36:47.138848+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f03f88b8-8f40-4dff-a6f2-87338b80bf99', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 03:36:47.139309+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f3fd76d5-f0ad-4115-b2cc-aa547aa014a6', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 04:34:47.13916+00', ''),
	('00000000-0000-0000-0000-000000000000', '40a8ba43-574a-4424-98d2-9400bc36acae', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 04:34:47.139576+00', ''),
	('00000000-0000-0000-0000-000000000000', '6c4b2ef4-6adb-4ff3-a418-a5a8acd2b311', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 05:32:47.148505+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b2b0266f-295b-4590-9c01-ed84a85cb57d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 05:32:47.14898+00', ''),
	('00000000-0000-0000-0000-000000000000', '699b8cad-48cd-4195-8d1e-c73a024cee01', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 06:30:47.157566+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd8a594c9-f5aa-4a68-aaaf-f8dca0d8954d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 06:30:47.158019+00', ''),
	('00000000-0000-0000-0000-000000000000', '19b06eb7-5fa8-4a2a-822e-c7059761c0bf', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 07:28:47.154445+00', ''),
	('00000000-0000-0000-0000-000000000000', '75d8cc95-09d1-463e-896e-adb5f3589d8b', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 07:28:47.154945+00', ''),
	('00000000-0000-0000-0000-000000000000', '736ebfd3-e30c-4b5a-8621-ae48935929ee', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 08:26:47.151835+00', ''),
	('00000000-0000-0000-0000-000000000000', '6572af58-f9af-47ea-9bd1-0ae6dbc7d577', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 08:26:47.15228+00', ''),
	('00000000-0000-0000-0000-000000000000', '24a5fbe3-0552-45d5-8328-5f1490339632', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 09:24:55.938547+00', ''),
	('00000000-0000-0000-0000-000000000000', '11794299-999f-427b-ab28-9ace5e6ef490', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 09:24:55.939013+00', ''),
	('00000000-0000-0000-0000-000000000000', '3630c3d7-da50-4487-9d79-e79e68e84931', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 10:22:55.9366+00', ''),
	('00000000-0000-0000-0000-000000000000', '552f934b-17d1-4441-84e1-6b08fd50d3a0', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 10:22:55.937088+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fe2d9362-05d0-490c-9195-d1259eaad250', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 11:20:55.943591+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd967a526-6a35-4d55-b168-34686579ddd4', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 11:20:55.944063+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c097c7a6-184a-481a-be06-1a2ffe998c4c', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 12:18:55.942739+00', ''),
	('00000000-0000-0000-0000-000000000000', '1b732049-b552-4309-8214-a0a21fbaf812', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 12:18:55.943209+00', ''),
	('00000000-0000-0000-0000-000000000000', '1a511078-5384-4b3b-acf1-fdb45ff23b8a', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 13:16:55.956217+00', ''),
	('00000000-0000-0000-0000-000000000000', '0501c1dd-b262-4c87-ad69-a7ffd160edb9', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 13:16:55.956673+00', ''),
	('00000000-0000-0000-0000-000000000000', '8e594a76-a5f6-4699-b910-af35700fa968', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 14:14:55.951561+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a64b7b7b-7e3e-49e7-87a2-babed65d304c', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 14:14:55.952055+00', ''),
	('00000000-0000-0000-0000-000000000000', '0eabe34d-5537-4686-8d7e-ab3a042dc7b3', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 16:50:55.131496+00', ''),
	('00000000-0000-0000-0000-000000000000', '4ec4e1b2-b42c-4232-9ebe-53da7921043f', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 16:50:55.132026+00', ''),
	('00000000-0000-0000-0000-000000000000', '264762ab-a075-4932-bb5d-29dbca0eb205', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 20:02:27.63937+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c41690ac-396b-4030-8440-e447d7e6cf24', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 20:02:27.64004+00', ''),
	('00000000-0000-0000-0000-000000000000', 'db836560-e75a-4de4-b0f0-ae08a14b49a2', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 21:10:25.838476+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f5886498-a409-418b-9e6c-6f7028149aac', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 21:10:25.839184+00', ''),
	('00000000-0000-0000-0000-000000000000', '84ed15a4-8864-4ffd-bfcc-ac613bf00498', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 22:08:42.986978+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e339e0ef-c408-49df-9dc9-ce03f7f30d1d', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-01 22:08:42.987407+00', ''),
	('00000000-0000-0000-0000-000000000000', '31a8d3bf-2673-4659-b40c-639f47b54406', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-02 05:42:07.405219+00', ''),
	('00000000-0000-0000-0000-000000000000', '974d83ce-47c0-46e5-baa6-15f1718f4bd6', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-02 05:42:07.406554+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bd247978-58b1-4641-a5b2-9be7b2ca8164', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-02 22:35:01.803068+00', ''),
	('00000000-0000-0000-0000-000000000000', '42fadd3b-8359-48a7-afb0-583929559421', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-02 22:35:01.804697+00', ''),
	('00000000-0000-0000-0000-000000000000', '508ecbcf-a718-4f69-9940-748b800b3ac5', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-03 12:01:19.575219+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b0838165-ebce-4973-8e39-cf48434e65f5', '{"action":"token_revoked","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-03 12:01:19.575766+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c8a3582d-e2cc-42c3-8199-7d4298e92308', '{"action":"token_refreshed","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"token"}', '2026-02-03 12:01:19.661386+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f9f395a8-45ad-45b5-8eb8-63ac7ffc37b8', '{"action":"logout","actor_id":"f9423574-1219-4040-8687-d009f0ad403c","actor_name":"Eitan baron","actor_username":"eitan2007@gmail.com","actor_via_sso":false,"log_type":"account"}', '2026-02-03 12:07:10.258072+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'e63870e8-7e6b-4d89-b481-57420171b43c', 'authenticated', 'authenticated', 'admin@test.com', '$2a$10$D.ylmYzyKBo62zsA0quO/OBBS/9jHlF3k86b8Zx6OSi0nkkpnTJri', '2026-01-25 10:28:25.831978+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"full_name": "admin", "email_verified": true}', NULL, '2026-01-25 10:28:25.828126+00', '2026-01-25 10:28:25.832458+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', 'authenticated', 'authenticated', 'user@test.com', '$2a$10$pHCRFLRZ/8PzHzkxjAMq1e9QMPciqYzFZV4CPof8A9X8gE8kL4F4u', '2026-01-25 10:28:25.932882+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"full_name": "user", "email_verified": true}', NULL, '2026-01-25 10:28:25.929342+00', '2026-01-25 10:28:25.933333+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', 'authenticated', 'authenticated', 'guest@test.com', '$2a$10$nSyTPiioVkgwFFl/kYo7yuk9eJldVNPSAomgZC1LG5WnuTj6XRzm.', '2026-01-25 10:28:26.014461+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "GUEST", "provider": "email", "providers": ["email"]}', '{"full_name": "guest", "email_verified": true}', NULL, '2026-01-25 10:28:26.010943+00', '2026-01-25 10:28:26.014902+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', 'authenticated', 'authenticated', 'ester1347@gmail.com', '$2a$10$6/4mRnuSXcbXk1gzqh9z7OkCE3sn720f7K.8UR.mgnqjM2Zc3y08a', '2026-01-25 11:59:02.041454+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": true, "phone_verified": false}', NULL, '2026-01-25 11:59:02.035917+00', '2026-01-25 11:59:02.041454+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f9423574-1219-4040-8687-d009f0ad403c', 'authenticated', 'authenticated', 'eitan2007@gmail.com', '$2a$10$cz28KHo5QXU.O6yF1Ye7WeY1.jSUYo0z0z2SIZ9mQYRw30XWdW04S', '2026-01-25 10:18:51.760164+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-01-29 10:09:55.924672+00', '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "email_verified": true, "phone_verified": false}', NULL, '2026-01-25 10:18:51.755362+00', '2026-02-03 12:01:19.577181+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('f9423574-1219-4040-8687-d009f0ad403c', 'f9423574-1219-4040-8687-d009f0ad403c', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "email_verified": true, "phone_verified": false}', 'email', '2026-01-25 10:18:51.758572+00', '2026-01-25 10:18:51.758589+00', '2026-01-25 10:18:51.758589+00', '77d8bd7a-f3dc-474c-8183-c4ba3f68ebf9'),
	('e63870e8-7e6b-4d89-b481-57420171b43c', 'e63870e8-7e6b-4d89-b481-57420171b43c', '{"sub": "e63870e8-7e6b-4d89-b481-57420171b43c", "email": "admin@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.830504+00', '2026-01-25 10:28:25.830542+00', '2026-01-25 10:28:25.830542+00', 'c8768d7b-b9ba-4922-b65a-c082a253b37d'),
	('75d43a9c-61d7-4dd8-9175-8ad3aa226def', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', '{"sub": "75d43a9c-61d7-4dd8-9175-8ad3aa226def", "email": "user@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.931556+00', '2026-01-25 10:28:25.931581+00', '2026-01-25 10:28:25.931581+00', '10f2730b-0c31-45c0-9c82-72f47e6bde45'),
	('d78cafe6-1983-4c21-90a2-5033f5cffaac', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', '{"sub": "d78cafe6-1983-4c21-90a2-5033f5cffaac", "email": "guest@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:26.013269+00', '2026-01-25 10:28:26.013288+00', '2026-01-25 10:28:26.013288+00', '7bff2220-73d5-4633-af27-b422f4fdbf83'),
	('f361ab72-98ea-4b20-b4c1-f583ad7450db', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 11:59:02.039935+00', '2026-01-25 11:59:02.039954+00', '2026-01-25 11:59:02.039954+00', '1b221c09-5154-4646-892b-7042704939b3');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: albums; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: photos; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_roles" ("id", "code", "description") VALUES
	(1, 'ADMIN', 'Administrator with full access'),
	(2, 'USER', 'Standard user'),
	(3, 'GUEST', 'Guest user with limited access');


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "created_at", "updated_at", "role_id") VALUES
	('e63870e8-7e6b-4d89-b481-57420171b43c', 'admin@test.com', 'admin', NULL, '2026-01-25 10:28:25.827926+00', '2026-01-25 10:28:25.827926+00', 1),
	('75d43a9c-61d7-4dd8-9175-8ad3aa226def', 'user@test.com', 'user', NULL, '2026-01-25 10:28:25.929232+00', '2026-01-25 10:28:25.929232+00', 2),
	('d78cafe6-1983-4c21-90a2-5033f5cffaac', 'guest@test.com', 'guest', NULL, '2026-01-25 10:28:26.010834+00', '2026-01-25 10:28:26.010834+00', 3),
	('f361ab72-98ea-4b20-b4c1-f583ad7450db', 'ester1347@gmail.com', 'avatars', NULL, '2026-01-25 11:59:02.035917+00', '2026-01-25 11:59:02.035917+00', 2),
	('f9423574-1219-4040-8687-d009f0ad403c', 'eitan2007@gmail.com', 'Eitan baron', NULL, '2026-01-25 10:18:51.755159+00', '2026-01-25 11:31:00.507+00', 1);


--
-- Data for Name: template_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."template_categories" ("id", "code", "label") VALUES
	(1, 'GRID', 'Grid'),
	(2, 'GEOMETRIC', 'Geometric'),
	(3, 'ARTISTIC', 'Artistic'),
	(4, 'DIAGONAL', 'Diagonal'),
	(5, 'CUSTOM', 'Custom');


--
-- Data for Name: template_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."template_types" ("id", "code", "description") VALUES
	(1, 'GRID', 'Standard grid layouts'),
	(2, 'ADVANCED', 'Advanced layouts');


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."templates" ("id", "name", "photo_count", "grid", "regions", "created_by", "is_system", "is_active", "sort_order", "created_at", "updated_at", "type_id", "category_id") VALUES
	('v-strips-3', 'V Strips', 3, NULL, '[{"id": "v1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 33, "height": 100}, "zIndex": 0}, {"id": "v2", "shape": "rect", "bounds": {"x": 33, "y": 0, "width": 34, "height": 100}, "zIndex": 0}, {"id": "v3", "shape": "rect", "bounds": {"x": 67, "y": 0, "width": 33, "height": 100}, "zIndex": 0}]', 'system', true, true, 13, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('3-horiz-lead', '3 Photos', 3, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 100, "height": 58}}, {"id": "r2", "shape": "rect", "bounds": {"x": 0, "y": 58, "width": 50, "height": 42}}, {"id": "r3", "shape": "rect", "bounds": {"x": 50, "y": 58, "width": 50, "height": 42}}]', 'system', true, true, 3, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('center-circle-4', 'Center Circle', 5, NULL, '[{"id": "tl", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "tr", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "center", "shape": "circle", "bounds": {"x": 25, "y": 25, "width": 50, "height": 50}, "zIndex": 1}]', 'system', true, true, 7, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 2),
	('l-shape-mosaic', 'L-Shape Mosaic', 5, NULL, '[{"id": "big", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 60, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 60, "y": 0, "width": 40, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 60, "y": 30, "width": 40, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 40, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 40, "y": 60, "width": 60, "height": 40}, "zIndex": 0}]', 'system', true, true, 8, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('diagonal-4', 'Diagonal Strips', 4, NULL, '[{"id": "d1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 30, "height": 100}, "points": [[0, 0], [25, 0], [15, 100], [0, 100]], "zIndex": 0}, {"id": "d2", "shape": "polygon", "bounds": {"x": 15, "y": 0, "width": 35, "height": 100}, "points": [[25, 0], [50, 0], [40, 100], [15, 100]], "zIndex": 0}, {"id": "d3", "shape": "polygon", "bounds": {"x": 40, "y": 0, "width": 35, "height": 100}, "points": [[50, 0], [75, 0], [65, 100], [40, 100]], "zIndex": 0}, {"id": "d4", "shape": "polygon", "bounds": {"x": 65, "y": 0, "width": 35, "height": 100}, "points": [[75, 0], [100, 0], [100, 100], [65, 100]], "zIndex": 0}]', 'system', true, true, 9, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 4),
	('angular-3', 'Angular Shards', 3, NULL, '[{"id": "s1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 50, "height": 100}, "points": [[0, 0], [45, 0], [30, 60], [0, 50]], "zIndex": 0}, {"id": "s2", "shape": "polygon", "bounds": {"x": 30, "y": 0, "width": 70, "height": 70}, "points": [[45, 0], [100, 0], [100, 45], [60, 70], [30, 60]], "zIndex": 0}, {"id": "s3", "shape": "polygon", "bounds": {"x": 0, "y": 45, "width": 100, "height": 55}, "points": [[0, 50], [30, 60], [60, 70], [100, 45], [100, 100], [0, 100]], "zIndex": 0}]', 'system', true, true, 10, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 4),
	('feature-4-small', 'Feature + 4', 5, NULL, '[{"id": "main", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 50, "y": 30, "width": 50, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 50, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 60, "width": 50, "height": 40}, "zIndex": 0}]', 'system', true, true, 11, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 3),
	('magazine-mix', 'Magazine Mix', 7, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 60}}, {"id": "r2", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 30}}, {"id": "r3", "shape": "rect", "bounds": {"x": 50, "y": 30, "width": 50, "height": 30}}, {"id": "r4", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 25, "height": 40}}, {"id": "r5", "shape": "rect", "bounds": {"x": 25, "y": 60, "width": 25, "height": 40}}, {"id": "r6", "shape": "rect", "bounds": {"x": 50, "y": 60, "width": 25, "height": 40}}, {"id": "r7", "shape": "rect", "bounds": {"x": 75, "y": 60, "width": 25, "height": 40}}]', 'system', true, true, 14, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 3),
	('1-full', '1 Photo', 1, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 100, "height": 100}}]', 'system', true, true, 1, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('2-horiz', '2 Photos', 2, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 100}}, {"id": "r2", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 100}}]', 'system', true, true, 2, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('4-mosaic-1', '4 Photos', 4, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 50}}, {"id": "r2", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 50}}, {"id": "r3", "shape": "rect", "bounds": {"x": 0, "y": 50, "width": 50, "height": 50}}, {"id": "r4", "shape": "rect", "bounds": {"x": 50, "y": 50, "width": 50, "height": 50}}]', 'system', true, true, 5, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('4-vert-lead', '4 Photos', 4, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 67, "height": 100}}, {"id": "r2", "shape": "rect", "bounds": {"x": 67, "y": 0, "width": 33, "height": 33}}, {"id": "r3", "shape": "rect", "bounds": {"x": 67, "y": 33, "width": 33, "height": 34}}, {"id": "r4", "shape": "rect", "bounds": {"x": 67, "y": 67, "width": 33, "height": 33}}]', 'system', true, true, 4, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('mosaic-9', 'Mosaic Grid', 9, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 33.33, "height": 33.33}}, {"id": "r2", "shape": "rect", "bounds": {"x": 33.33, "y": 0, "width": 33.33, "height": 33.33}}, {"id": "r3", "shape": "rect", "bounds": {"x": 66.66, "y": 0, "width": 33.34, "height": 33.33}}, {"id": "r4", "shape": "rect", "bounds": {"x": 0, "y": 33.33, "width": 33.33, "height": 33.33}}, {"id": "r5", "shape": "rect", "bounds": {"x": 33.33, "y": 33.33, "width": 33.33, "height": 33.33}}, {"id": "r6", "shape": "rect", "bounds": {"x": 66.66, "y": 33.33, "width": 33.34, "height": 33.33}}, {"id": "r7", "shape": "rect", "bounds": {"x": 0, "y": 66.66, "width": 33.33, "height": 33.34}}, {"id": "r8", "shape": "rect", "bounds": {"x": 33.33, "y": 66.66, "width": 33.33, "height": 33.34}}, {"id": "r9", "shape": "rect", "bounds": {"x": 66.66, "y": 66.66, "width": 33.34, "height": 33.34}}]', 'system', true, true, 12, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1),
	('6-mosaic-grid', 'Mosaic Grid', 6, NULL, '[{"id": "r1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 50}}, {"id": "r2", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 50}}, {"id": "r3", "shape": "rect", "bounds": {"x": 0, "y": 50, "width": 25, "height": 50}}, {"id": "r4", "shape": "rect", "bounds": {"x": 25, "y": 50, "width": 25, "height": 50}}, {"id": "r5", "shape": "rect", "bounds": {"x": 50, "y": 50, "width": 25, "height": 50}}, {"id": "r6", "shape": "rect", "bounds": {"x": 75, "y": 50, "width": 25, "height": 50}}]', 'system', true, true, 6, '2026-01-25 10:04:32.524+00', '2026-01-25 09:29:01.100638+00', 2, 1);


--
-- Data for Name: user_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_settings" ("user_id", "settings", "created_at", "updated_at") VALUES
	('f9423574-1219-4040-8687-d009f0ad403c', '{"defaultPhotoGap": 2, "themePreference": "light", "defaultAlbumSize": "20x20", "defaultSpineText": "My Album", "spineEffectColor": "#9ca3af", "spineEffectWidth": 20, "defaultPageMargin": 0, "defaultSpineColor": "#000000", "defaultSpineWidth": 15, "hiddenTemplateIds": [], "spineEffectSpread": 1, "allowedTemplateIds": [], "autoFillLayoutMode": "full", "spineEffectOpacity": 0.27, "defaultCornerRadius": 0, "defaultSpineOpacity": 0.2, "defaultSpineFontSize": 10, "exportWarnDuplicates": true, "autoFillSmartMatching": true, "defaultEditorViewMode": "full", "defaultSpineDirection": "ltr", "defaultSpineFontStyle": "italic", "defaultSpineTextAlign": "center", "defaultSpineTextColor": "#ffffff", "defaultBackgroundColor": "#ffffff", "defaultSpineFontFamily": "Tahoma", "defaultSpineFontWeight": "normal", "spineEffectColorOpacity": 0.35, "autoFillMaxPhotosPerPage": 4, "spineEffectCenterOpacity": 0, "visibleTemplateCategories": ["grid", "advanced", "cover"]}', '2026-01-29 00:17:30.500135+00', '2026-01-30 14:46:00.548+00');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('photos', 'photos', NULL, '2026-01-29 09:36:07.851196+00', '2026-01-29 09:36:07.851196+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('avatars', 'avatars', NULL, '2026-01-29 09:36:07.891385+00', '2026-01-29 09:36:07.891385+00', true, false, NULL, NULL, NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 47, true);


--
-- Name: template_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."template_categories_id_seq"', 1, false);


--
-- Name: template_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."template_types_id_seq"', 1, false);


--
-- Name: user_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."user_roles_id_seq"', 1, false);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict YHIOLeCcVsEPgH5BlkfKceI3NVO7snKg81NDE7LP1lPikwiDMjqlH0E8ie6gV2s

RESET ALL;
