-- Factory Reset Script (Wipe Everything)
-- Purpose: Completely clears all data from public and auth schemas while maintaining the structure.
-- Use this for: Scenario 1 - Working with an existing DB that you want to start fresh.
-- WARNING: This deletes ALL users, photos, albums, and settings. This cannot be undone.

SET session_replication_role = replica;

-- 1. Clear Public Data
TRUNCATE TABLE "public"."photos" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."albums" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."user_settings" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."profiles" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."templates" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."template_categories" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."template_types" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "public"."user_roles" RESTART IDENTITY CASCADE;

-- 2. Clear Auth Data
DELETE FROM "auth"."users";
DELETE FROM "auth"."identities";

SET session_replication_role = origin;

-- Success Message (Optional check)
-- SELECT count(*) FROM auth.users; -- Should be 0
