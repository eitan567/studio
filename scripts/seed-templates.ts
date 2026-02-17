
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Import static templates
import { LAYOUT_TEMPLATES } from '../src/components/album/layouts/templates';
import { COVER_TEMPLATES } from '../src/components/album/layouts/templates';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

// Create Supabase client directly (bypassing app logic)
const supabase = createClient(supabaseUrl, supabaseKey);

// Legacy static IDs were strings; DB now uses integer IDs.
const TEMPLATE_ID_MAP: Record<string, number> = {
    'magazine-mix': 1,
    'v-strips-3': 2,
    '3-horiz-lead': 3,
    'center-circle-4': 4,
    'l-shape-mosaic': 5,
    '1-full': 6,
    'diagonal-4': 7,
    'mosaic-9': 8,
    'angular-3': 9,
    'feature-4-small': 10,
    '2-horiz': 11,
    '4-vert-lead': 12,
    '4-mosaic-1': 13,
    '6-mosaic-grid': 14
};

function resolveNumericTemplateId(id: string | number): number | null {
    if (typeof id === 'number') return id;
    const mapped = TEMPLATE_ID_MAP[id];
    if (!mapped) {
        console.warn(`Skipping template with unmapped legacy id: ${id}`);
        return null;
    }
    return mapped;
}

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

    // Helper to find classification ID
    const getClassificationId = (type?: string) => {
        if (!type) return 2; // Default to SPREAD
        const upper = type.toUpperCase();
        return classifications.find(c => c.code === upper)?.id || 2;
    };

    // 2. Transform Templates

    // Transform static templates from code into DB rows
    const gridRows = LAYOUT_TEMPLATES.map((t) => ({
        id: resolveNumericTemplateId(t.id),
        name: t.name,
        type_id: 1, // GRID
        category_id: 1, // GRID
        grid: null,
        regions: t.regions,
        photo_count: t.photoCount,
        created_by: null,
        is_system: true,
        is_active: true,
        classification_type_id: getClassificationId(t.type),
        template_config: null,
        created_at: new Date().toISOString()
    })).filter((t) => t.id !== null);

    // Cover templates are aligned to grid category in this schema
    const coverRows = COVER_TEMPLATES.map((t) => ({
        id: resolveNumericTemplateId(t.id),
        name: t.name,
        type_id: 1, // GRID
        category_id: 1, // GRID
        grid: null,
        regions: t.regions,
        photo_count: t.photoCount,
        created_by: null,
        is_system: true,
        is_active: true,
        classification_type_id: getClassificationId(t.type),
        template_config: null,
        created_at: new Date().toISOString()
    })).filter((t) => t.id !== null);

    const rawTemplates = [...gridRows, ...coverRows];

    // Deduplicate by ID (latest wins)
    let uniqueTemplates = Array.from(
        new Map(rawTemplates.map(item => [item.id, item])).values()
    );

    // Assign sequential sort_order (1..N) after deduplication
    uniqueTemplates = uniqueTemplates.map((t, index) => ({
        ...t,
        sort_order: index + 1
    }));

    console.log(`Found ${uniqueTemplates.length} unique templates to sync from static code definitions.`);

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
