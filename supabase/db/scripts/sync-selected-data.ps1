param(
    [string]$SourceContainer = "supabase_db_studio",
    [string]$TargetContainer = "supabase_db_supabase-secondary",
    [string]$DbName = "postgres",
    [string]$DbUser = "postgres"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$tables = @(
    "public.user_roles",
    "auth.instances",
    "auth.users",
    "auth.identities",
    "public.profiles",
    "public.template_categories",
    "public.template_classifications",
    "public.template_types",
    "public.canva_frames",
    "public.templates",
    "public.user_settings",
    "storage.buckets"
)

foreach ($table in $tables) {
    Write-Host "==> Syncing $table"
    $tempHost = Join-Path $env:TEMP ("studio_sync_" + ($table -replace "[^a-zA-Z0-9]", "_") + ".sql")
    $tempInContainer = "/tmp/studio_sync.sql"

    & docker exec $SourceContainer pg_dump -U $DbUser -d $DbName `
        --data-only --inserts --column-inserts --no-owner --no-privileges `
        "--table=$table" -f $tempInContainer
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed for table $table"
    }

    & docker cp "${SourceContainer}:$tempInContainer" $tempHost
    if ($LASTEXITCODE -ne 0) { throw "docker cp source failed for $table" }

    & docker exec $SourceContainer rm -f $tempInContainer | Out-Null

    & docker cp $tempHost "${TargetContainer}:$tempInContainer"
    if ($LASTEXITCODE -ne 0) { throw "docker cp target failed for $table" }

    & docker exec $TargetContainer psql -v ON_ERROR_STOP=0 -U $DbUser -d $DbName -f $tempInContainer
    if ($LASTEXITCODE -ne 0) {
        throw "psql import failed for table $table"
    }

    & docker exec $TargetContainer rm -f $tempInContainer | Out-Null
    Remove-Item -Path $tempHost -Force -ErrorAction SilentlyContinue
}

Write-Host "==> Done"
