
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import static templates
// Note: We need to use relative paths from scripts/ directory
import { LAYOUT_TEMPLATES } from '../src/components/album/layouts/templates';
import { COVER_TEMPLATES } from '../src/components/album/layouts/templates';
import { ADVANCED_TEMPLATES } from '../src/lib/advanced-layout-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

// Create Supabase client directly (bypassing app logic)
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedTemplates() {
    console.log(`Connecting to Supabase at ${supabaseUrl}...`);

    // Transform Static Grid Templates to DB Schema
    const gridRows = LAYOUT_TEMPLATES.map((t, index) => ({
        id: t.id,
        name: t.name,
        type: 'grid',
        grid: t.grid,
        photo_count: t.grid.length,
        is_active: true,
        sort_order: index,
        created_at: new Date().toISOString()
    }));

    // Transform Static Cover Templates
    const coverRows = COVER_TEMPLATES.map((t, index) => ({
        id: t.id,
        name: t.name,
        type: 'cover',
        grid: t.grid,
        photo_count: t.grid.length,
        is_active: true,
        sort_order: index,
        created_at: new Date().toISOString()
    }));

    // Transform Static Advanced Templates
    const advancedRows = ADVANCED_TEMPLATES.map((t, index) => ({
        id: t.id,
        name: t.name,
        type: 'advanced',
        category: t.category,
        photo_count: t.photoCount,
        regions: t.regions,
        created_by: t.createdBy,
        is_active: true,
        sort_order: index,
        created_at: new Date().toISOString()
    }));

    const rawTemplates = [...gridRows, ...coverRows, ...advancedRows];

    // Deduplicate by ID (latest wins)
    const uniqueTemplates = Array.from(
        new Map(rawTemplates.map(item => [item.id, item])).values()
    );

    console.log(`Found ${uniqueTemplates.length} unique templates to sync (from ${rawTemplates.length} total).`);

    // Upsert
    const { error } = await supabase
        .from('templates')
        .upsert(uniqueTemplates, { onConflict: 'id' });

    if (error) {
        console.error('Error seeding templates:', error);
        process.exit(1);
    }

    console.log('Successfully seeded templates!');
}

seedTemplates();
