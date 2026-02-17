import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type TemplateRow = {
  id: number;
  name: string;
  photo_count: number;
  grid: unknown | null;
  regions: unknown | null;
  created_by: string | null;
  is_system: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  type_id: number | null;
  category_id: number | null;
  classification_type_id: number | null;
  template_config: string | null;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function main() {
  const localUrl = getEnv('LOCAL_SUPABASE_URL');
  const localServiceRoleKey = getEnv('LOCAL_SUPABASE_SERVICE_ROLE_KEY');
  const remoteUrl = getEnv('REMOTE_SUPABASE_URL');
  const remoteServiceRoleKey = getEnv('REMOTE_SUPABASE_SERVICE_ROLE_KEY');

  const local = createClient(localUrl, localServiceRoleKey);
  const remote = createClient(remoteUrl, remoteServiceRoleKey);

  console.log(`Local:  ${localUrl}`);
  console.log(`Remote: ${remoteUrl}`);

  const [typesRes, categoriesRes, classRes, templatesRes] = await Promise.all([
    local.from('template_types').select('*').order('id', { ascending: true }),
    local.from('template_categories').select('*').order('id', { ascending: true }),
    local.from('template_classifications').select('*').order('id', { ascending: true }),
    local.from('templates').select('*').order('id', { ascending: true }),
  ]);

  if (typesRes.error) throw typesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  if (classRes.error) throw classRes.error;
  if (templatesRes.error) throw templatesRes.error;

  const localTypes = typesRes.data ?? [];
  const localCategories = categoriesRes.data ?? [];
  const localClassifications = classRes.data ?? [];
  const localTemplates = (templatesRes.data ?? []) as TemplateRow[];

  if (localTemplates.length === 0) {
    throw new Error('Local templates table is empty. Aborting.');
  }

  console.log(`Fetched from local: ${localTemplates.length} templates`);

  // Ensure FK tables exist/up to date on remote.
  {
    const upType = await remote.from('template_types').upsert(localTypes, { onConflict: 'id' });
    if (upType.error) throw upType.error;

    const upCat = await remote.from('template_categories').upsert(localCategories, { onConflict: 'id' });
    if (upCat.error) throw upCat.error;

    const upClass = await remote.from('template_classifications').upsert(localClassifications, { onConflict: 'id' });
    if (upClass.error) throw upClass.error;
  }

  // Clean created_by values that don't exist on remote profiles.
  const distinctCreators = Array.from(
    new Set(localTemplates.map((t) => t.created_by).filter((v): v is string => !!v))
  );

  let validCreators = new Set<string>();
  if (distinctCreators.length > 0) {
    const { data: remoteProfiles, error: profilesErr } = await remote
      .from('profiles')
      .select('id')
      .in('id', distinctCreators);
    if (profilesErr) throw profilesErr;
    validCreators = new Set((remoteProfiles ?? []).map((p: { id: string }) => p.id));
  }

  const normalizedTemplates = localTemplates.map((t) => ({
    ...t,
    created_by: t.created_by && validCreators.has(t.created_by) ? t.created_by : null,
  }));

  const byBatch = chunk(normalizedTemplates, 100);
  for (let i = 0; i < byBatch.length; i += 1) {
    const { error } = await remote
      .from('templates')
      .upsert(byBatch[i], { onConflict: 'id' });
    if (error) throw error;
    console.log(`Upserted batch ${i + 1}/${byBatch.length}`);
  }

  // Remove stale rows not present locally.
  const localIds = normalizedTemplates.map((t) => t.id);
  if (localIds.length > 0) {
    const idsCsv = localIds.join(',');
    const { error: delError } = await remote
      .from('templates')
      .delete()
      .not('id', 'in', `(${idsCsv})`);
    if (delError) throw delError;
  }

  const { count: remoteCount, error: countErr } = await remote
    .from('templates')
    .select('id', { count: 'exact', head: true });
  if (countErr) throw countErr;

  const { count: remoteNonNullCfgCount, error: cfgErr } = await remote
    .from('templates')
    .select('id', { count: 'exact', head: true })
    .not('template_config', 'is', null);
  if (cfgErr) throw cfgErr;

  console.log(`Remote templates after sync: ${remoteCount ?? 0}`);
  console.log(`Remote templates with template_config: ${remoteNonNullCfgCount ?? 0}`);
  console.log('Template sync completed.');
}

main().catch((err) => {
  console.error('Template sync failed:', err);
  process.exit(1);
});

