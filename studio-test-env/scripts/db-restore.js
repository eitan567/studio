const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function restore() {
    console.log('Starting Supabase database restore...');

    try {
        // 1. Reset database (this clears it and runs migrations)
        console.log('Resetting database and applying migrations...');
        // 1. Reset database (this clears it and runs migrations)
        console.log('Resetting database and applying migrations...');
        try {
            execSync('npx supabase db reset', { stdio: 'inherit' });
        } catch (e) {
            console.warn('Warning: db reset failed or returned an error. Attempting to continue...');
        }

        // Wait a bit for DB to be stable
        console.log('Waiting for database to stabilize...');
        execSync('sleep 5', { stdio: 'inherit' });

        // Get container name
        console.log('Detecting database container...');
        const containerName = execSync('docker ps --format "{{.Names}}" | grep _db_ || true').toString().trim().split('\n')[0];

        if (!containerName) {
            throw new Error('Could not find Supabase database container. Is Supabase running?');
        }
        console.log(`Using container: ${containerName}`);

        // 2. Truncate tables to avoid "duplicate key" errors from migrations
        console.log('Clearing existing data to prepare for restore...');
        const truncateSql = 'TRUNCATE TABLE albums, photos, profiles, user_settings, templates, template_types, template_categories, user_roles CASCADE;';
        execSync(`docker exec -i ${containerName} psql -U postgres -d postgres -c "${truncateSql}"`, { stdio: 'inherit' });

        // 3. Apply auth data
        if (fs.existsSync('supabase/auth_data.sql')) {
            console.log('Applying auth schema data...');
            execSync(`docker exec -i ${containerName} psql -U postgres -d postgres < supabase/auth_data.sql`, { stdio: 'inherit' });
        }

        // 4. Apply public data
        if (fs.existsSync('supabase/data.sql')) {
            console.log('Applying public schema data...');
            execSync(`docker exec -i ${containerName} psql -U postgres -d postgres < supabase/data.sql`, { stdio: 'inherit' });
        }

        console.log('Restore completed successfully.');
    } catch (error) {
        console.error('Restore failed:', error.message);
        process.exit(1);
    }
}

restore();
