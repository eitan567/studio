/**
 * Seed Templates Script
 * 
 * Populates the templates table with existing static templates.
 * Run with: npx tsx scripts/seed-templates.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import templates - using require for compatibility
const { LAYOUT_TEMPLATES, COVER_TEMPLATES } = require('../src/components/album/layout-templates');
const { ADVANCED_TEMPLATES } = require('../src/lib/advanced-layout-types');

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedTemplates() {
    console.log('🌱 Seeding templates...\n');

    // Prepare grid templates
    const gridTemplates = LAYOUT_TEMPLATES.map((t, i) => ({
        id: t.id,
        name: t.name,
        type: 'grid',
        category: 'layout',
        photo_count: t.grid.length,
        grid: t.grid,
        regions: null,
        created_by: 'system',
        is_system: true,
        is_active: true,
        sort_order: i,
    }));

    // Prepare cover templates
    const coverTemplates = COVER_TEMPLATES.map((t, i) => ({
        id: `cover-${t.id}`,
        name: t.name,
        type: 'cover',
        category: 'cover',
        photo_count: t.grid.length,
        grid: t.grid,
        regions: null,
        created_by: 'system',
        is_system: true,
        is_active: true,
        sort_order: i,
    }));

    // Prepare advanced templates
    const advancedTemplates = ADVANCED_TEMPLATES.map((t, i) => ({
        id: t.id,
        name: t.name,
        type: 'advanced',
        category: t.category,
        photo_count: t.photoCount,
        grid: null,
        regions: t.regions,
        created_by: t.createdBy || 'system',
        is_system: true,
        is_active: true,
        sort_order: i,
    }));

    const allTemplates = [...gridTemplates, ...coverTemplates, ...advancedTemplates];

    console.log(`📦 Preparing ${gridTemplates.length} grid, ${coverTemplates.length} cover, ${advancedTemplates.length} advanced templates\n`);

    // Upsert all templates (update if exists, insert if not)
    const { data, error } = await supabase
        .from('templates')
        .upsert(allTemplates, { onConflict: 'id' })
        .select();

    if (error) {
        console.error('❌ Error seeding templates:', error);
        process.exit(1);
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} templates!\n`);

    // Show summary
    const summary = await supabase
        .from('templates')
        .select('type')
        .eq('is_active', true);

    if (summary.data) {
        const counts = summary.data.reduce((acc: Record<string, number>, t) => {
            acc[t.type] = (acc[t.type] || 0) + 1;
            return acc;
        }, {});
        console.log('📊 Template counts in DB:');
        console.log(`   Grid: ${counts.grid || 0}`);
        console.log(`   Cover: ${counts.cover || 0}`);
        console.log(`   Advanced: ${counts.advanced || 0}`);
    }

    console.log('\n🎉 Done!');
}

seedTemplates().catch(console.error);
