---
description: How to set up the local development environment and restore the database
---

Follow these steps to set up the Studio project on a new machine.

// turbo-all
1. **Prepare Environment**
   - Ensure Docker is running.
   - Install dependencies: `npm install`

2. **Initialize Supabase**
   - Run `npx supabase start`
   - If there are container conflicts, run `npx supabase stop` first.

3. **Restore Database**
   - Run `npm run db:restore`
   - This script will:
     - Reset the database and apply migrations.
     - Truncate conflicting tables.
     - Import `auth_data.sql` and `data.sql`.

4. **Update Environment Variables**
   - Run `npx supabase status` to get the API URL and keys.
   - Update `.env.local` with the new project credentials:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`

5. **Verify**
   - Run `npm run dev` and ensure the app loads development data.
