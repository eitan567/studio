-- Full System Setup Script (Cold Start)
-- Purpose: Initialize a fresh database with the complete Studio environment.
-- Includes: Roles, 5 Users (Auth, Identities, Profiles, Settings), and all Templates.
-- Safety: Uses session_replication_role = replica and ON CONFLICT DO NOTHING.

SET session_replication_role = replica;

-- 1. USER ROLES
INSERT INTO "public"."user_roles" ("id", "code", "description") VALUES
  (1, 'ADMIN', 'Administrator with full access'),
  (2, 'USER', 'Standard user'),
  (3, 'GUEST', 'Guest user with limited access')
ON CONFLICT (id) DO NOTHING;

-- 2. TEMPLATE CATEGORIES
INSERT INTO "public"."template_categories" ("id", "code", "label") VALUES
  (1, 'GRID', 'Grid'),
  (2, 'GEOMETRIC', 'Geometric'),
  (3, 'ARTISTIC', 'Artistic'),
  (4, 'DIAGONAL', 'Diagonal'),
  (5, 'CUSTOM', 'Custom')
ON CONFLICT (id) DO NOTHING;

-- 3. TEMPLATE TYPES
INSERT INTO "public"."template_types" ("id", "code", "description") VALUES
  (1, 'GRID', 'Standard grid layouts'),
  (2, 'ADVANCED', 'Advanced layouts')
ON CONFLICT (id) DO NOTHING;

-- 4. AUTH USERS (5 System Accounts)
INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at", "is_anonymous", "confirmation_token", "recovery_token", "email_change_token_new", "email_change") VALUES
  ('00000000-0000-0000-0000-000000000000', 'f9423574-1219-4040-8687-d009f0ad403c', 'authenticated', 'authenticated', 'eitan2007@gmail.com', '$2a$10$cz28KHo5QXU.O6yF1Ye7WeY1.jSUYo0z0z2SIZ9mQYRw30XWdW04S', '2026-01-25 10:18:51.760164+00', '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "email_verified": true, "phone_verified": false}', '2026-01-25 10:18:51.755362+00', '2026-01-28 00:13:07.069249+00', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'e63870e8-7e6b-4d89-b481-57420171b43c', 'authenticated', 'authenticated', 'admin@test.com', '$2a$10$D.ylmYzyKBo62zsA0quO/OBBS/9jHlF3k86b8Zx6OSi0nkkpnTJri', '2026-01-25 10:28:25.831978+00', '{"role": "ADMIN", "provider": "email", "providers": ["email"]}', '{"full_name": "admin", "email_verified": true}', '2026-01-25 10:28:25.828126+00', '2026-01-25 10:28:25.832458+00', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', 'authenticated', 'authenticated', 'user@test.com', '$2a$10$pHCRFLRZ/8PzHzkxjAMq1e9QMPciqYzFZV4CPof8A9X8gE8kL4F4u', '2026-01-25 10:28:25.932882+00', '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"full_name": "user", "email_verified": true}', '2026-01-25 10:28:25.929342+00', '2026-01-25 10:28:25.933333+00', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', 'authenticated', 'authenticated', 'guest@test.com', '$2a$10$nSyTPiioVkgwFFl/kYo7yuk9eJldVNPSAomgZC1LG5WnuTj6XRzm.', '2026-01-25 10:28:26.014461+00', '{"role": "GUEST", "provider": "email", "providers": ["email"]}', '{"full_name": "guest", "email_verified": true}', '2026-01-25 10:28:26.010943+00', '2026-01-25 10:28:26.014902+00', false, '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', 'authenticated', 'authenticated', 'ester1347@gmail.com', '$2a$10$6/4mRnuSXcbXk1gzqh9z7OkCE3sn720f7K.8UR.mgnqjM2Zc3y08a', '2026-01-25 11:59:02.041454+00', '{"role": "USER", "provider": "email", "providers": ["email"]}', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": true, "phone_verified": false}', '2026-01-25 11:59:02.035917+00', '2026-01-25 11:59:02.041454+00', false, '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 5. AUTH IDENTITIES
INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
  ('f9423574-1219-4040-8687-d009f0ad403c', 'f9423574-1219-4040-8687-d009f0ad403c', '{"sub": "f9423574-1219-4040-8687-d009f0ad403c", "email": "eitan2007@gmail.com", "full_name": "Eitan baron", "email_verified": true, "phone_verified": false}', 'email', '2026-01-25 10:18:51.758572+00', '2026-01-25 10:18:51.758589+00', '2026-01-25 10:18:51.758589+00', '77d8bd7a-f3dc-474c-8183-c4ba3f68ebf9'),
  ('e63870e8-7e6b-4d89-b481-57420171b43c', 'e63870e8-7e6b-4d89-b481-57420171b43c', '{"sub": "e63870e8-7e6b-4d89-b481-57420171b43c", "email": "admin@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.830504+00', '2026-01-25 10:28:25.830542+00', '2026-01-25 10:28:25.830542+00', 'c8768d7b-b9ba-4922-b65a-c082a253b37d'),
  ('75d43a9c-61d7-4dd8-9175-8ad3aa226def', '75d43a9c-61d7-4dd8-9175-8ad3aa226def', '{"sub": "75d43a9c-61d7-4dd8-9175-8ad3aa226def", "email": "user@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:25.931556+00', '2026-01-25 10:28:25.931581+00', '2026-01-25 10:28:25.931581+00', '10f2730b-0c31-45c0-9c82-72f47e6bde45'),
  ('d78cafe6-1983-4c21-90a2-5033f5cffaac', 'd78cafe6-1983-4c21-90a2-5033f5cffaac', '{"sub": "d78cafe6-1983-4c21-90a2-5033f5cffaac", "email": "guest@test.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 10:28:26.013269+00', '2026-01-25 10:28:26.013288+00', '2026-01-25 10:28:26.013288+00', '7bff2220-73d5-4633-af27-b422f4fdbf83'),
  ('f361ab72-98ea-4b20-b4c1-f583ad7450db', 'f361ab72-98ea-4b20-b4c1-f583ad7450db', '{"sub": "f361ab72-98ea-4b20-b4c1-f583ad7450db", "email": "ester1347@gmail.com", "full_name": "avatars", "email_verified": false, "phone_verified": false}', 'email', '2026-01-25 11:59:02.039935+00', '2026-01-25 11:59:02.039954+00', '2026-01-25 11:59:02.039954+00', '1b221c09-5154-4646-892b-7042704939b3')
ON CONFLICT (id) DO NOTHING;

-- 6. PUBLIC PROFILES
INSERT INTO "public"."profiles" ("id", "email", "full_name", "avatar_url", "role_id", "created_at", "updated_at") VALUES
  ('f9423574-1219-4040-8687-d009f0ad403c', 'eitan2007@gmail.com', 'Eitan baron', 'http://127.0.0.1:54321/storage/v1/object/public/avatars/f9423574-1219-4040-8687-d009f0ad403c/1769340658869.jpg', 1, '2026-01-25 10:18:51.755159', '2026-01-25 11:31:00.507'),
  ('e63870e8-7e6b-4d89-b481-57420171b43c', 'admin@test.com', 'admin', NULL, 1, '2026-01-25 10:28:25.827926', '2026-01-25 10:28:25.827926'),
  ('75d43a9c-61d7-4dd8-9175-8ad3aa226def', 'user@test.com', 'user', NULL, 2, '2026-01-25 10:28:25.929232', '2026-01-25 10:28:25.929232'),
  ('d78cafe6-1983-4c21-90a2-5033f5cffaac', 'guest@test.com', 'guest', NULL, 3, '2026-01-25 10:28:26.010834', '2026-01-25 10:28:26.010834'),
  ('f361ab72-98ea-4b20-b4c1-f583ad7450db', 'ester1347@gmail.com', 'avatars', NULL, 2, '2026-01-25 11:59:02.035917', '2026-01-25 11:59:02.035917')
ON CONFLICT (id) DO NOTHING;

-- 7. USER SETTINGS (Eitan's Defaults)
INSERT INTO "public"."user_settings" ("user_id", "settings", "created_at", "updated_at") VALUES
  ('f9423574-1219-4040-8687-d009f0ad403c', '{"defaultPhotoGap":2,"themePreference":"light","defaultAlbumSize":"20x20","defaultSpineText":"My Album","spineEffectColor":"#9ca3af","spineEffectWidth":160,"defaultPageMargin":0,"defaultSpineColor":"#000000","defaultSpineWidth":15,"hiddenTemplateIds":[],"spineEffectSpread":22,"allowedTemplateIds":[],"autoFillLayoutMode":"full","spineEffectOpacity":0.64,"defaultCornerRadius":0,"defaultSpineOpacity":0.2,"defaultSpineFontSize":10,"exportWarnDuplicates":true,"autoFillSmartMatching":true,"defaultEditorViewMode":"full","defaultSpineDirection":"ltr","defaultSpineFontStyle":"italic","defaultSpineTextAlign":"center","defaultSpineTextColor":"#ffffff","defaultBackgroundColor":"#ffffff","defaultSpineFontFamily":"Tahoma","defaultSpineFontWeight":"normal","spineEffectColorOpacity":0.9,"autoFillMaxPhotosPerPage":4,"spineEffectCenterOpacity":0.85,"visibleTemplateCategories":["grid","advanced","cover"]}'::jsonb, '2026-01-29 00:17:30.500135', '2026-01-29 00:17:30.367')
ON CONFLICT (user_id) DO NOTHING;

-- 8. TEMPLATES
INSERT INTO "public"."templates" ("id", "name", "photo_count", "grid", "regions", "created_by", "is_system", "is_active", "sort_order", "created_at", "updated_at", "type_id", "category_id") VALUES
  ('1-full', '1 Photo', 1, '["col-span-12 row-span-12"]', NULL, NULL, true, true, 1, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('2-horiz', '2 Photos', 2, '["col-span-6 row-span-12", "col-span-6 row-span-12"]', NULL, NULL, true, true, 2, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('3-horiz-lead', '3 Photos', 3, '["col-span-12 row-start-1 row-end-8", "col-start-1 col-end-7 row-start-8 row-end-13", "col-start-7 col-end-13 row-start-8 row-end-13"]', NULL, NULL, true, true, 3, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('4-vert-lead', '4 Photos', 4, '["col-start-1 col-end-8 row-span-12", "col-start-8 col-end-13 row-start-1 row-end-5", "col-start-8 col-end-13 row-start-5 row-end-9", "col-start-8 col-end-13 row-start-9 row-end-13"]', NULL, NULL, true, true, 4, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('4-mosaic-1', '4 Photos', 4, '["col-start-1 col-end-9 row-start-1 row-end-8", "col-start-9 col-end-13 row-start-1 row-end-8", "col-start-1 col-end-7 row-start-8 row-end-13", "col-start-7 col-end-13 row-start-8 row-end-13"]', NULL, NULL, true, true, 5, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('6-mosaic-grid', 'Mosaic Grid', 6, '["col-start-1 col-end-9 row-start-1 row-end-9", "col-start-9 col-end-13 row-start-1 row-end-5", "col-start-9 col-end-13 row-start-5 row-end-9", "col-start-1 col-end-5 row-start-9 row-end-13", "col-start-5 col-end-9 row-start-9 row-end-13", "col-start-9 col-end-13 row-start-9 row-end-13"]', NULL, NULL, true, true, 6, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1),
  ('center-circle-4', 'Center Circle', 5, NULL, '[{"id": "tl", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "tr", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "center", "shape": "circle", "bounds": {"x": 25, "y": 25, "width": 50, "height": 50}, "zIndex": 1}]', 'system', true, true, 7, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 2),
  ('l-shape-mosaic', 'L-Shape Mosaic', 5, NULL, '[{"id": "big", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 60, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 60, "y": 0, "width": 40, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 60, "y": 30, "width": 40, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 40, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 40, "y": 60, "width": 60, "height": 40}, "zIndex": 0}]', 'system', true, true, 8, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1),
  ('diagonal-4', 'Diagonal Strips', 4, NULL, '[{"id": "d1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 30, "height": 100}, "points": [[0, 0], [25, 0], [15, 100], [0, 100]], "zIndex": 0}, {"id": "d2", "shape": "polygon", "bounds": {"x": 15, "y": 0, "width": 35, "height": 100}, "points": [[25, 0], [50, 0], [40, 100], [15, 100]], "zIndex": 0}, {"id": "d3", "shape": "polygon", "bounds": {"x": 40, "y": 0, "width": 35, "height": 100}, "points": [[50, 0], [75, 0], [65, 100], [40, 100]], "zIndex": 0}, {"id": "d4", "shape": "polygon", "bounds": {"x": 65, "y": 0, "width": 35, "height": 100}, "points": [[75, 0], [100, 0], [100, 100], [65, 100]], "zIndex": 0}]', 'system', true, true, 9, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 4),
  ('v-strips-3', 'V Strips', 3, NULL, '[{"id": "v1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 33, "height": 100}, "zIndex": 0}, {"id": "v2", "shape": "rect", "bounds": {"x": 33, "y": 0, "width": 34, "height": 100}, "zIndex": 0}, {"id": "v3", "shape": "rect", "bounds": {"x": 67, "y": 0, "width": 33, "height": 100}, "zIndex": 0}]', 'system', true, true, 13, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1),
  ('angular-3', 'Angular Shards', 3, NULL, '[{"id": "s1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 50, "height": 100}, "points": [[0, 0], [45, 0], [30, 60], [0, 50]], "zIndex": 0}, {"id": "s2", "shape": "polygon", "bounds": {"x": 30, "y": 0, "width": 70, "height": 70}, "points": [[45, 0], [100, 0], [100, 45], [60, 70], [30, 60]], "zIndex": 0}, {"id": "s3", "shape": "polygon", "bounds": {"x": 0, "y": 45, "width": 100, "height": 55}, "points": [[0, 50], [30, 60], [60, 70], [100, 45], [100, 100], [0, 100]], "zIndex": 0}]', 'system', true, true, 10, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 4),
  ('feature-4-small', 'Feature + 4', 5, NULL, '[{"id": "main", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 50, "y": 30, "width": 50, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 50, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 60, "width": 50, "height": 40}, "zIndex": 0}]', 'system', true, true, 11, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 3),
  ('mosaic-9', 'Mosaic Grid', 9, NULL, '[{"id": "m1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 40, "height": 33}, "zIndex": 0}, {"id": "m2", "shape": "rect", "bounds": {"x": 40, "y": 0, "width": 30, "height": 33}, "zIndex": 0}, {"id": "m3", "shape": "rect", "bounds": {"x": 70, "y": 0, "width": 30, "height": 50}, "zIndex": 0}, {"id": "m4", "shape": "rect", "bounds": {"x": 0, "y": 33, "width": 25, "height": 34}, "zIndex": 0}, {"id": "m5", "shape": "rect", "bounds": {"x": 25, "y": 33, "width": 45, "height": 34}, "zIndex": 0}, {"id": "m6", "shape": "rect", "bounds": {"x": 70, "y": 50, "width": 30, "height": 50}, "zIndex": 0}, {"id": "m7", "shape": "rect", "bounds": {"x": 0, "y": 67, "width": 35, "height": 33}, "zIndex": 0}, {"id": "m8", "shape": "rect", "bounds": {"x": 35, "y": 67, "width": 35, "height": 33}, "zIndex": 0}]', 'system', true, true, 12, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1),
  ('magazine-mix', 'Magazine Mix', 7, NULL, '[{"id": "big", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 60, "height": 70}, "zIndex": 0}, {"id": "r1", "shape": "rect", "bounds": {"x": 60, "y": 0, "width": 40, "height": 35}, "zIndex": 0}, {"id": "r2", "shape": "rect", "bounds": {"x": 60, "y": 35, "width": 40, "height": 35}, "zIndex": 0}, {"id": "b1", "shape": "rect", "bounds": {"x": 0, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b2", "shape": "rect", "bounds": {"x": 25, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b3", "shape": "rect", "bounds": {"x": 50, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b4", "shape": "rect", "bounds": {"x": 75, "y": 70, "width": 25, "height": 30}, "zIndex": 0}]', 'system', true, true, 14, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 3)
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
