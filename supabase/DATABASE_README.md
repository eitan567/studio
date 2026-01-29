# Studio Database Management

This directory contains scripts to manage your Supabase database core environment (Local or Remote).

## 🚀 Lifecyle Scenarios

### Scenario 1: Factory Reset (Clean Start)
**Goal**: You have an existing database with "messy" data and want to wipe everything and start clean.
1. Run **[factory-reset.sql](file:///c:/Users/Eitan%20Baron/Documents/GitHub/studio/supabase/factory-reset.sql)** in the SQL Editor. *Warning: This deletes everything.*
2. Run **[full-system-setup.sql](file:///c:/Users/Eitan%20Baron/Documents/GitHub/studio/supabase/full-system-setup.sql)** to restore the core system data and 5 users.

### Scenario 2: Handling Conflicts (Safe Update)
**Goal**: You have an existing database and want to update roles/templates without breaking anything.
1. Just run **[full-system-setup.sql](file:///c:/Users/Eitan%20Baron/Documents/GitHub/studio/supabase/full-system-setup.sql)**.
2. The scripts use `ON CONFLICT DO NOTHING`, so if a user or template already exists, it is safely ignored.
3. If you only want to update logic (no user data), use **[system-logic-update.sql](file:///c:/Users/Eitan%20Baron/Documents/GitHub/studio/supabase/system-logic-update.sql)**.

### Scenario 3: Initial Setup (No DB / New Machine)
**Goal**: You have a brand new project with no tables at all.
1. **Migrations First**: Run `npx supabase start` (local) or run all scripts in `supabase/migrations/` (remote) to create the table structure.
2. **Data Second**: Run **[full-system-setup.sql](file:///c:/Users/Eitan%20Baron/Documents/GitHub/studio/supabase/full-system-setup.sql)** to populate the system data and users.

## 🛠 Manual Data Sync
If you need to sync templates from code to database:
```bash
npx tsx scripts/seed-templates.ts
```

## ⚠️ Safety
All scripts use `SET session_replication_role = replica;` to ensure triggers and RLS don't block the restoration, and `ON CONFLICT DO NOTHING` to prevent errors on repeated runs.

## User Data (Albums, Photos)

User data is host-specific and is not managed by the repository. To back up or transfer user data, please use manual SQL exports tailored for the specific environment.

> [!CAUTION]
> Avoid transferring `public.photos` or `public.albums` blindly between databases, as they contain hardcoded URLs and UUIDs that may break on a different host.
