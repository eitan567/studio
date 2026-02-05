-- System Logic Update Script
-- Purpose: Update core system definitions (Roles, Templates) without affecting users or personal data.
-- Use this for: Updating template layouts or adding new roles to an existing database.
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

INSERT INTO "public"."template_types" ("id", "code", "description") VALUES
  (1, 'GRID', 'Standard grid layouts'),
  (2, 'ADVANCED', 'Advanced layouts')
ON CONFLICT (id) DO NOTHING;

-- 4. TEMPLATE CLASSIFICATIONS
INSERT INTO "public"."template_classifications" ("id", "code", "label") VALUES
  (1, 'SINGLE', 'Single Page'),
  (2, 'SPREAD', 'Double Page Spread'),
  (3, 'BOTH', 'Both')
ON CONFLICT (id) DO NOTHING;

-- 5. TEMPLATES
INSERT INTO "public"."templates" ("id", "name", "photo_count", "grid", "regions", "created_by", "is_system", "is_active", "sort_order", "created_at", "updated_at", "type_id", "category_id", "classification_type_id") VALUES
  ('1-full', '1 Photo', 1, '["col-span-12 row-span-12"]', NULL, NULL, true, true, 1, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('2-horiz', '2 Photos', 2, '["col-span-6 row-span-12", "col-span-6 row-span-12"]', NULL, NULL, true, true, 2, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('3-horiz-lead', '3 Photos', 3, '["col-span-12 row-start-1 row-end-8", "col-start-1 col-end-7 row-start-8 row-end-13", "col-start-7 col-end-13 row-start-8 row-end-13"]', NULL, NULL, true, true, 3, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('4-vert-lead', '4 Photos', 4, '["col-start-1 col-end-8 row-span-12", "col-start-8 col-end-13 row-start-1 row-end-5", "col-start-8 col-end-13 row-start-5 row-end-9", "col-start-8 col-end-13 row-start-9 row-end-13"]', NULL, NULL, true, true, 4, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('4-mosaic-1', '4 Photos', 4, '["col-start-1 col-end-9 row-start-1 row-end-8", "col-start-9 col-end-13 row-start-1 row-end-8", "col-start-1 col-end-7 row-start-8 row-end-13", "col-start-7 col-end-13 row-start-8 row-end-13"]', NULL, NULL, true, true, 5, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('6-mosaic-grid', 'Mosaic Grid', 6, '["col-start-1 col-end-9 row-start-1 row-end-9", "col-start-9 col-end-13 row-start-1 row-end-5", "col-start-9 col-end-13 row-start-5 row-end-9", "col-start-1 col-end-5 row-start-9 row-end-13", "col-start-5 col-end-9 row-start-9 row-end-13", "col-start-9 col-end-13 row-start-9 row-end-13"]', NULL, NULL, true, true, 6, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 1, 1, 2),
  ('center-circle-4', 'Center Circle', 5, NULL, '[{"id": "tl", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "tr", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 50}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 50, "width": 50, "height": 50}, "zIndex": 0}, {"id": "center", "shape": "circle", "bounds": {"x": 25, "y": 25, "width": 50, "height": 50}, "zIndex": 1}]', 'system', true, true, 7, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 2, 2),
  ('l-shape-mosaic', 'L-Shape Mosaic', 5, NULL, '[{"id": "big", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 60, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 60, "y": 0, "width": 40, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 60, "y": 30, "width": 40, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 40, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 40, "y": 60, "width": 60, "height": 40}, "zIndex": 0}]', 'system', true, true, 8, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1, 2),
  ('diagonal-4', 'Diagonal Strips', 4, NULL, '[{"id": "d1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 30, "height": 100}, "points": [[0, 0], [25, 0], [15, 100], [0, 100]], "zIndex": 0}, {"id": "d2", "shape": "polygon", "bounds": {"x": 15, "y": 0, "width": 35, "height": 100}, "points": [[25, 0], [50, 0], [40, 100], [15, 100]], "zIndex": 0}, {"id": "d3", "shape": "polygon", "bounds": {"x": 40, "y": 0, "width": 35, "height": 100}, "points": [[50, 0], [75, 0], [65, 100], [40, 100]], "zIndex": 0}, {"id": "d4", "shape": "polygon", "bounds": {"x": 65, "y": 0, "width": 35, "height": 100}, "points": [[75, 0], [100, 0], [100, 100], [65, 100]], "zIndex": 0}]', 'system', true, true, 9, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 4, 2),
  ('v-strips-3', 'V Strips', 3, NULL, '[{"id": "v1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 33, "height": 100}, "zIndex": 0}, {"id": "v2", "shape": "rect", "bounds": {"x": 33, "y": 0, "width": 34, "height": 100}, "zIndex": 0}, {"id": "v3", "shape": "rect", "bounds": {"x": 67, "y": 0, "width": 33, "height": 100}, "zIndex": 0}]', 'system', true, true, 13, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1, 2),
  ('angular-3', 'Angular Shards', 3, NULL, '[{"id": "s1", "shape": "polygon", "bounds": {"x": 0, "y": 0, "width": 50, "height": 100}, "points": [[0, 0], [45, 0], [30, 60], [0, 50]], "zIndex": 0}, {"id": "s2", "shape": "polygon", "bounds": {"x": 30, "y": 0, "width": 70, "height": 70}, "points": [[45, 0], [100, 0], [100, 45], [60, 70], [30, 60]], "zIndex": 0}, {"id": "s3", "shape": "polygon", "bounds": {"x": 0, "y": 45, "width": 100, "height": 55}, "points": [[0, 50], [30, 60], [60, 70], [100, 45], [100, 100], [0, 100]], "zIndex": 0}]', 'system', true, true, 10, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 4, 2),
  ('feature-4-small', 'Feature + 4', 5, NULL, '[{"id": "main", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 50, "height": 60}, "zIndex": 0}, {"id": "tr1", "shape": "rect", "bounds": {"x": 50, "y": 0, "width": 50, "height": 30}, "zIndex": 0}, {"id": "tr2", "shape": "rect", "bounds": {"x": 50, "y": 30, "width": 50, "height": 30}, "zIndex": 0}, {"id": "bl", "shape": "rect", "bounds": {"x": 0, "y": 60, "width": 50, "height": 40}, "zIndex": 0}, {"id": "br", "shape": "rect", "bounds": {"x": 50, "y": 60, "width": 50, "height": 40}, "zIndex": 0}]', 'system', true, true, 11, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 3, 2),
  ('mosaic-9', 'Mosaic Grid', 9, NULL, '[{"id": "m1", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 40, "height": 33}, "zIndex": 0}, {"id": "m2", "shape": "rect", "bounds": {"x": 40, "y": 0, "width": 30, "height": 33}, "zIndex": 0}, {"id": "m3", "shape": "rect", "bounds": {"x": 70, "y": 0, "width": 30, "height": 50}, "zIndex": 0}, {"id": "m4", "shape": "rect", "bounds": {"x": 0, "y": 33, "width": 25, "height": 34}, "zIndex": 0}, {"id": "m5", "shape": "rect", "bounds": {"x": 25, "y": 33, "width": 45, "height": 34}, "zIndex": 0}, {"id": "m6", "shape": "rect", "bounds": {"x": 70, "y": 50, "width": 30, "height": 50}, "zIndex": 0}, {"id": "m7", "shape": "rect", "bounds": {"x": 0, "y": 67, "width": 35, "height": 33}, "zIndex": 0}, {"id": "m8", "shape": "rect", "bounds": {"x": 35, "y": 67, "width": 35, "height": 33}, "zIndex": 0}]', 'system', true, true, 12, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 1, 2),
  ('magazine-mix', 'Magazine Mix', 7, NULL, '[{"id": "big", "shape": "rect", "bounds": {"x": 0, "y": 0, "width": 60, "height": 70}, "zIndex": 0}, {"id": "r1", "shape": "rect", "bounds": {"x": 60, "y": 0, "width": 40, "height": 35}, "zIndex": 0}, {"id": "r2", "shape": "rect", "bounds": {"x": 60, "y": 35, "width": 40, "height": 35}, "zIndex": 0}, {"id": "b1", "shape": "rect", "bounds": {"x": 0, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b2", "shape": "rect", "bounds": {"x": 25, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b3", "shape": "rect", "bounds": {"x": 50, "y": 70, "width": 25, "height": 30}, "zIndex": 0}, {"id": "b4", "shape": "rect", "bounds": {"x": 75, "y": 70, "width": 25, "height": 30}, "zIndex": 0}]', 'system', true, true, 14, '2026-01-25 10:04:32.524', '2026-01-25 09:29:01.100638', 2, 3, 2)
ON CONFLICT (id) DO NOTHING;

SET session_replication_role = origin;
