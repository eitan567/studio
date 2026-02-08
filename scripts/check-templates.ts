
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Load env vars
const envPath = resolve(process.cwd(), '.env.local');

console.log('Loading env from:', envPath);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.log('No .env.local found at:', envPath);
    // Try .env
    const envPathDefault = resolve(process.cwd(), '.env');
    if (fs.existsSync(envPathDefault)) {
        console.log('Loading .env from:', envPathDefault);
        dotenv.config({ path: envPathDefault });
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Static templates from templates.tsx (copied here to avoid import issues in script)
const STATIC_IDS = [
    '1-full',
    '2-horiz',
    '3-horiz-lead',
    '4-vert-lead',
    '4-mosaic-1',
    '6-mosaic-grid'
];

async function checkTemplates() {
    console.log('Checking for static templates in DB...');
    console.log('Static IDs:', STATIC_IDS);

    const { data: templates, error } = await supabase
        .from('templates')
        .select('id, name, is_system')
        .in('id', STATIC_IDS);

    if (error) {
        console.error('Error fetching templates:', error);
        return;
    }

    console.log('\n--- Results ---');
    if (!templates || templates.length === 0) {
        console.log('No static templates found in DB.');
        console.log('It is safe to say these are PURELY ghost templates from code.');
    } else {
        console.log(`Found ${templates.length} matching templates in DB:`);
        templates.forEach(t => {
            console.log(`- ID: ${t.id}, Name: ${t.name}, Is System: ${t.is_system}`);
        });
    }

    // Also check for any templates with is_system = true (user claim)
    const { data: systemTemplates, error: sysError } = await supabase
        .from('templates')
        .select('id, name, is_system')
        .eq('is_system', true);

    if (sysError) {
        console.error('Error checking system templates:', sysError);
    } else {
        console.log('\n--- System Templates in DB ---');
        if (!systemTemplates || systemTemplates.length === 0) {
            console.log('No templates with is_system=true found in DB.');
        } else {
            console.log(`Found ${systemTemplates.length} templates with is_system=true:`);
            systemTemplates.forEach(t => console.log(`- [${t.id}] ${t.name}`));
        }
    }
}

checkTemplates();
