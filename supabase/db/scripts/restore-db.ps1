param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$Container = "",
    [string]$DbName = "postgres",
    [string]$DbUser = "postgres",
    [switch]$AllowRestoreToSourceContainer
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

function Invoke-DockerExec {
    param(
        [string]$ContainerName,
        [string[]]$ExecArgs
    )

    & docker exec $ContainerName @ExecArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker exec failed: $($ExecArgs -join " ")"
    }
}

$resolvedBackupPath = (Resolve-Path -Path $BackupPath).Path
$schemaPath = Join-Path $resolvedBackupPath "schema.sql"
$dataPath = Join-Path $resolvedBackupPath "data.sql"
$manifestPath = Join-Path $resolvedBackupPath "manifest.json"

if (-not (Test-Path $schemaPath)) { throw "Missing schema dump: $schemaPath" }
if (-not (Test-Path $dataPath)) { throw "Missing data dump: $dataPath" }

$targetContainer = Get-DbContainer -RequestedContainer $Container

$sourceContainer = $null
if (Test-Path $manifestPath) {
    $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
    if ($null -ne $manifest.source -and $null -ne $manifest.source.container) {
        $sourceContainer = [string]$manifest.source.container
    }
}

if (
    -not $AllowRestoreToSourceContainer.IsPresent -and
    -not [string]::IsNullOrWhiteSpace($sourceContainer) -and
    $sourceContainer -eq $targetContainer
) {
    throw "Refusing to restore into source container '$sourceContainer'. Use a different container or pass -AllowRestoreToSourceContainer."
}

$remoteSchemaPath = "/tmp/studio_restore_schema.sql"
$remoteDataPath = "/tmp/studio_restore_data.sql"

Write-Step "Target container: $targetContainer"
Write-Step "Copying SQL files into container"

& docker cp $schemaPath "${targetContainer}:$remoteSchemaPath"
if ($LASTEXITCODE -ne 0) { throw "Failed to copy schema.sql into container." }

& docker cp $dataPath "${targetContainer}:$remoteDataPath"
if ($LASTEXITCODE -ne 0) { throw "Failed to copy data.sql into container." }

try {
    Write-Step "Restoring schema"
    Invoke-DockerExec -ContainerName $targetContainer -ExecArgs @(
        "psql", "-v", "ON_ERROR_STOP=0",
        "-U", $DbUser,
        "-d", $DbName,
        "-f", $remoteSchemaPath
    )

    Write-Step "Restoring data"
    Invoke-DockerExec -ContainerName $targetContainer -ExecArgs @(
        "psql", "-v", "ON_ERROR_STOP=0",
        "-U", $DbUser,
        "-d", $DbName,
        "-f", $remoteDataPath
    )
}
finally {
    & docker exec $targetContainer rm -f $remoteSchemaPath $remoteDataPath 2>$null | Out-Null
}

Write-Step "Restore completed successfully."
