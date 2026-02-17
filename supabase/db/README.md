# Local Supabase DB Backup/Restore (Docker)

This workflow is designed for **local Supabase Docker only**.  
Production is intentionally out of scope.

## What This System Guarantees

1. Backs up **all schema structures** (tables, indexes, constraints, FKs, triggers, functions, RLS policies, etc.).
2. Backs up **table data** for the full DB, with explicit exclusions:
   - `public.album`
   - `public.albums`
   - `public.photos` (data excluded, schema included)
   - `storage.buckets` (bucket data excluded, schema included)
   - `storage.objects` (bucket object data excluded, schema included)
   - `storage.s3_multipart_uploads`
   - `storage.s3_multipart_uploads_parts`
3. Includes users/system/profiles data (unless a table is in the exclusion list above).
4. Does **not** modify source DB during backup (read-only dump operations).

## Files

- `supabase/db/scripts/backup-local-db.ps1` - creates a full backup set.
- `supabase/db/scripts/restore-db.ps1` - restores a backup set into a target Docker DB container.
- `supabase/db/backups/<timestamp>/schema.sql`
- `supabase/db/backups/<timestamp>/data.sql`
- `supabase/db/backups/<timestamp>/manifest.json`

## Prerequisites

- Docker is running.
- Local Supabase stack is running (`npx supabase start`).
- PowerShell.

## 1) Create Backup

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\db\scripts\backup-local-db.ps1
```

Optional:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\db\scripts\backup-local-db.ps1 -Label before-migration
```

If multiple Supabase DB containers are running:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\db\scripts\backup-local-db.ps1 -Container supabase_db_studio
```

## 2) Restore Backup (Only to a New/Target Instance)

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\db\scripts\restore-db.ps1 -BackupPath .\supabase\db\backups\20260217-120000-before-migration -Container supabase_db_newinstance
```

Safety guard:
- If `manifest.json` says the backup came from the same container, restore is blocked by default.
- Override only when intentional:

```powershell
powershell -ExecutionPolicy Bypass -File .\supabase\db\scripts\restore-db.ps1 -BackupPath <path> -Container <same_container> -AllowRestoreToSourceContainer
```

## 3) Suggested Verification After Restore

Run on target container:

```powershell
docker exec <target_container> psql -U postgres -d postgres -c "select count(*) as profiles_count from public.profiles;"
docker exec <target_container> psql -U postgres -d postgres -c "select count(*) as users_count from auth.users;"
docker exec <target_container> psql -U postgres -d postgres -c "select count(*) as photos_count from public.photos;"
docker exec <target_container> psql -U postgres -d postgres -c "select count(*) as albums_count from public.albums;"
docker exec <target_container> psql -U postgres -d postgres -c "select count(*) as bucket_rows from storage.buckets;"
```

Expected:
- `profiles`/`auth.users` restored.
- `photos` and `albums` table structures exist, but data is excluded from backup.
- bucket data tables are excluded from backup data.

## Notes for Human/AI Execution

- Always back up from local Docker source container only.
- Never run restore on the current active instance unless explicitly intended.
- Keep `manifest.json` with each backup; it documents hash + inclusion policy.
