# Database Migration Guide

This guide explains how to back up your local Supabase database and restore it on another machine or a remote server.

## 🛠 Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed.
- Docker running (for local development).

> [!IMPORTANT]
> **JWT Portability:** For authentication to work seamlessly across machines, ensure your `supabase/config.toml` includes the same `jwt_secret` in the `[auth]` section. If this is missing, new machines will generate a different secret, making existing user tokens invalid.

## 💾 Backing Up the Database

To create a backup of your local database (both application data and authentication data):

```bash
npm run db:backup
```

This will generate/update the following files in the `supabase/` directory:
- `data.sql`: Contains the `public` schema data (albums, photos, etc.).
- `auth_data.sql`: Contains the `auth` schema data (users, sessions, etc.).

> [!TIP]
> Commit these files to your Git repository to sync your database state with other team members or across your own machines.

## 🔄 Restoring the Database

To restore the database on a new machine or reset your local environment:

```bash
npm run db:restore
```

**Warning:** This will reset your local database to match the files in the `supabase/` directory. Any unsaved changes will be lost.

The restore process:
1. Resets the database and applies all migrations.
2. Applies the authentication data from `auth_data.sql`.
3. Applies the application data from `data.sql`.

## 🚀 Deployment to Remote Server

To sync your local schema (structure) with a remote Supabase project:

1. **Link your project:**
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```

2. **Push migrations:**
   ```bash
   npx supabase db push
   ```

3. **Import Data (Optional):**
   If you need to push local data to production, you can use the SQL Editor in the Supabase Dashboard to execute the contents of `data.sql`.

   > [!CAUTION]
   > Be extremely careful when pushing local data to a production environment, as it may overwrite or duplicate existing production records.
