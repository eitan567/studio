import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials (SUPABASE_SERVICE_ROLE_KEY is required)');
    process.exit(1);
}

// Create Supabase client with Service Role (Admin)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USERS = [
    { email: 'admin@test.com', password: 'password123', role_id: 1 }, // ADMIN
    { email: 'user@test.com', password: 'password123', role_id: 2 },  // USER
    { email: 'guest@test.com', password: 'password123', role_id: 3 }  // GUEST
];

async function seedUsers() {
    console.log(`Connecting to Supabase at ${supabaseUrl}...`);

    // 1. Create Test Users
    for (const user of TEST_USERS) {
        console.log(`Creating/Updating ${user.email}...`);

        // Check if user exists
        const { data: { users } } = await supabase.auth.admin.listUsers();
        let userId = users.find(u => u.email === user.email)?.id;

        if (!userId) {
            const { data, error } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: { full_name: user.email.split('@')[0] }
            });
            if (error) {
                console.error(`Error creating ${user.email}:`, error.message);
                continue;
            }
            userId = data.user!.id;
            console.log(`Created ${user.email} (${userId})`);
        } else {
            console.log(`User ${user.email} already exists.`);
        }

        // Update Role
        const { error: roleError } = await supabase
            .from('profiles')
            .update({ role_id: user.role_id })
            .eq('id', userId);

        if (roleError) console.error(`Failed to set role for ${user.email}:`, roleError);
    }

    // 2. Promote latest non-test user to ADMIN
    console.log('Promoting latest real user to ADMIN...');
    const { data: recentUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
    } else {
        // Filter out test users
        const testEmails = TEST_USERS.map(u => u.email);
        const realUsers = recentUsers.users.filter(u => !testEmails.includes(u.email || ''));

        // Sort by created_at desc
        realUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (realUsers.length > 0) {
            const adminUser = realUsers[0];
            console.log(`Found candidate: ${adminUser.email} (${adminUser.id})`);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ role_id: 1 }) // ADMIN
                .eq('id', adminUser.id);

            if (updateError) {
                console.error('Failed to promote user:', updateError);
            } else {
                console.log(`Successfully upgraded ${adminUser.email} to ADMIN.`);
            }
        } else {
            console.log('No real users found to promote.');
        }
    }

    console.log('User seeding complete.');
}

seedUsers().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
