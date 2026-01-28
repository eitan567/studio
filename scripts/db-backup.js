const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function backup() {
    console.log('Starting Supabase database backup...');

    try {
        // 1. Dump public schema data
        console.log('Dumping public schema data...');
        execSync('npx supabase db dump --local --data-only --schema public -f supabase/data.sql', { stdio: 'inherit' });

        // 2. Dump auth schema data
        console.log('Dumping auth schema data...');
        execSync('npx supabase db dump --local --data-only --schema auth -f supabase/auth_data.sql', { stdio: 'inherit' });

        // 3. Ensure seed.sql is updated if needed (optional)
        // fs.copyFileSync('supabase/data.sql', 'supabase/seed.sql');

        console.log('Backup completed successfully.');
        console.log('Files updated:');
        console.log(' - supabase/data.sql');
        console.log(' - supabase/auth_data.sql');
    } catch (error) {
        console.error('Backup failed:', error.message);
        process.exit(1);
    }
}

backup();
