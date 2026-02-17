param(
    [string]$OutputRoot = "supabase/db/backups",
    [string]$Label = "",
    [string]$Container = "",
    [string]$DbName = "postgres",
    [string]$DbUser = "postgres"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message"
}

function Get-DbContainer {
    param([string]$RequestedContainer)

    if (-not [string]::IsNullOrWhiteSpace($RequestedContainer)) {
        $exact = & docker ps --filter "name=^/${RequestedContainer}$" --format "{{.Names}}"
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($exact -join "").Trim())) {
            throw "Container '$RequestedContainer' not found or not running."
        }
        return $RequestedContainer
    }

    $found = @(
        & docker ps --filter "name=supabase_db_" --format "{{.Names}}" |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($found.Count -eq 0) {
        throw "No running container with name pattern 'supabase_db_' was found."
    }

    if ($found.Count -gt 1) {
        $names = $found -join ", "
        throw "Multiple Supabase DB containers found: $names. Re-run with -Container."
    }

    return $found[0]
}

function Invoke-DockerDumpToFile {
    param(
        [string]$ContainerName,
        [string[]]$ExecArgs,
        [string]$OutputFile
    )

    $stderrFile = [System.IO.Path]::GetTempFileName()
    $remoteFile = "/tmp/studio_dump_$(Get-Random).sql"
    try {
        & docker exec $ContainerName @ExecArgs "-f" $remoteFile 2> $stderrFile
        if ($LASTEXITCODE -ne 0) {
            $stderr = (Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue).Trim()
            throw "docker exec failed for '$($ExecArgs -join " ")'. $stderr"
        }

        & docker cp "${ContainerName}:$remoteFile" $OutputFile
        if ($LASTEXITCODE -ne 0) {
            throw "docker cp failed from ${ContainerName}:$remoteFile to $OutputFile"
        }
    }
    finally {
        & docker exec $ContainerName rm -f $remoteFile 2>$null | Out-Null
        Remove-Item -Path $stderrFile -Force -ErrorAction SilentlyContinue
    }
}

$excludedPublicDataTables = @(
    "public.album",
    "public.albums",
    "public.photos"
)

$explicitSystemDataTables = @(
    "auth.instances",
    "auth.users",
    "auth.identities",
    "storage.buckets"
)

$dbContainer = Get-DbContainer -RequestedContainer $Container

if (-not (Test-Path $OutputRoot)) {
    New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
}

$resolvedOutputRoot = (Resolve-Path -Path $OutputRoot).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = ($Label -replace "[^a-zA-Z0-9_-]", "_").Trim("_")
$backupFolderName = if ([string]::IsNullOrWhiteSpace($safeLabel)) { $timestamp } else { "$timestamp-$safeLabel" }
$backupPath = Join-Path $resolvedOutputRoot $backupFolderName

New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

$schemaPath = Join-Path $backupPath "schema.sql"
$dataPath = Join-Path $backupPath "data.sql"
$manifestPath = Join-Path $backupPath "manifest.json"

Write-Step "Using source container: $dbContainer"
Write-Step "Creating schema dump (all schemas / all objects)"

$schemaArgs = @(
    "pg_dump",
    "-U", $DbUser,
    "-d", $DbName,
    "--schema-only",
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges"
)

Invoke-DockerDumpToFile -ContainerName $dbContainer -ExecArgs $schemaArgs -OutputFile $schemaPath

Write-Step "Discovering tables for data backup policy"

$publicTablesQuery = "SELECT schemaname || '.' || tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;"
$publicTables = @(
    & docker exec $dbContainer psql -U $DbUser -d $DbName -Atqc $publicTablesQuery |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)

if ($LASTEXITCODE -ne 0) {
    throw "Failed to read public tables list."
}

$excludedPublicSet = New-Object "System.Collections.Generic.HashSet[string]" ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($item in $excludedPublicDataTables) {
    [void]$excludedPublicSet.Add($item)
}

$includedPublicTables = @(
    $publicTables | Where-Object { -not $excludedPublicSet.Contains($_) }
)

$includedDataTables = @()
$includedDataTables += $includedPublicTables
$includedDataTables += $explicitSystemDataTables

$includedDataTables = @(
    $includedDataTables |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Sort-Object -Unique
)

Write-Step "Creating data dump (public tables + users/profiles + bucket names, no albums/photos data)"

$dataArgs = @(
    "pg_dump",
    "-U", $DbUser,
    "-d", $DbName,
    "--data-only",
    "--column-inserts",
    "--inserts",
    "--no-owner",
    "--no-privileges"
)

foreach ($table in $includedDataTables) {
    $dataArgs += "--table=$table"
}

Invoke-DockerDumpToFile -ContainerName $dbContainer -ExecArgs $dataArgs -OutputFile $dataPath

$schemaHash = (Get-FileHash -Path $schemaPath -Algorithm SHA256).Hash
$dataHash = (Get-FileHash -Path $dataPath -Algorithm SHA256).Hash

$manifest = [ordered]@{
    created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    source = [ordered]@{
        container = $dbContainer
        db_name = $DbName
        db_user = $DbUser
    }
    files = [ordered]@{
        schema = [ordered]@{
            path = "schema.sql"
            sha256 = $schemaHash
        }
        data = [ordered]@{
            path = "data.sql"
            sha256 = $dataHash
        }
    }
    data_policy = [ordered]@{
        excluded_public_tables = $excludedPublicDataTables
        explicit_system_tables = $explicitSystemDataTables
        included_table_count = $includedDataTables.Count
        included_tables = $includedDataTables
    }
    notes = @(
        "Schema contains all objects (tables, indexes, constraints, functions, policies, triggers, etc.).",
        "Data includes all public tables except public.album/public.albums/public.photos.",
        "Data includes auth.instances, auth.users, auth.identities, and storage.buckets only from system schemas.",
        "No object payload tables (e.g. storage.objects) are included."
    )
}

$manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Step "Backup completed:"
Write-Host "    $backupPath"
