
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

    // 1. Seed Reference Tables
    console.log('Seeding Types and Categories...');

    const types = [
        { id: 1, code: 'GRID', description: 'Standard grid layouts' },
        { id: 2, code: 'ADVANCED', description: 'Advanced layouts' }
    ];
    const { error: typesError } = await supabase.from('template_types').upsert(types);
    if (typesError) throw typesError;

    const categories = [
        { id: 1, code: 'GRID', label: 'Grid' },
        { id: 2, code: 'GEOMETRIC', label: 'Geometric' },
        { id: 3, code: 'ARTISTIC', label: 'Artistic' },
        { id: 4, code: 'DIAGONAL', label: 'Diagonal' },
        { id: 5, code: 'CUSTOM', label: 'Custom' }
    ];
    const { error: catsError } = await supabase.from('template_categories').upsert(categories);
    if (catsError) throw catsError;

    const classifications = [
        { id: 1, code: 'SINGLE', label: 'Single Page' },
        { id: 2, code: 'SPREAD', label: 'Double Page Spread' },
        { id: 3, code: 'BOTH', label: 'Both' }
    ];
    const { error: classError } = await supabase.from('template_classifications').upsert(classifications);
    if (classError) throw classError;

    // Helper to find cat ID
    const getCatId = (code: string) => categories.find(c => c.code === code)?.id || 1;
    // Helper to find classification ID
    const getClassificationId = (type?: string) => {
        if (!type) return 2; // Default to SPREAD
        const upper = type.toUpperCase();
        return classifications.find(c => c.code === upper)?.id || 2;
    };

    // 2. Transform Templates

    // Transform Static Grid Templates
    const gridRows = LAYOUT_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        type_id: 1, // GRID
        category_id: 1, // GRID
        grid: null,
        regions: t.regions,
        photo_count: t.photoCount,
        is_active: true,
        classification_type_id: 2, // Default GRID to SPREAD
        created_at: new Date().toISOString()
    }));

    // Transform Static Cover Templates
    const coverRows = COVER_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        type_id: 1, // GRID
        category_id: 1, // GRID
        grid: null,
        regions: t.regions,
        photo_count: t.photoCount,
        is_active: true,
        classification_type_id: 2, // Default COVER to SPREAD
        created_at: new Date().toISOString()
    }));

    // Transform Static Advanced Templates
    const advancedRows = ADVANCED_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        type_id: 2, // ADVANCED
        category_id: getCatId(t.category.toUpperCase()),
        photo_count: t.photoCount,
        regions: t.regions,
        created_by: t.createdBy,
        is_active: true,
        classification_type_id: getClassificationId(t.type),
        created_at: new Date().toISOString()
    }));

    const rawTemplates = [...gridRows, ...coverRows, ...advancedRows];

    // Deduplicate by ID (latest wins)
    let uniqueTemplates = Array.from(
        new Map(rawTemplates.map(item => [item.id, item])).values()
    );

    // Assign sequential sort_order (1..N) after deduplication
    uniqueTemplates = uniqueTemplates.map((t, index) => ({
        ...t,
        sort_order: index + 1
    }));

    console.log(`Found ${uniqueTemplates.length} unique templates to sync.`);

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

seedTemplates().catch(err => {
    console.error('Fatal Script Error:', err);
    process.exit(1);
});
