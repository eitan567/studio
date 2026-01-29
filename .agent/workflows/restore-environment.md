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

3. **Seeding System Core Data**
   - Open the Supabase SQL Editor (either local or remote).
   - If this is a fresh setup, execute **`supabase/full-system-setup.sql`**.
   - If you only need logic updates, execute **`supabase/system-logic-update.sql`**.
   - Use `npx tsx scripts/seed-templates.ts` to ensure templates match the latest code definitions.

4. **Update Environment Variables**
   - Run `npx supabase status` (for local) or get credentials from the Dashboard (for remote).
   - Update `.env.local` with:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (Required for seeding and AI features)

5. **Verify and Run**
   - Run `npm run dev -- -p 9002` (or your preferred port).
   - Ensure you can log in with a system account (e.g., `admin@test.com`).
