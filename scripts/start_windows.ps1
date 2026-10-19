# Start FinAlly in Docker (Windows PowerShell). Usage: scripts\start_windows.ps1 [-Build]
param(
    [switch]$Build
)

$Image = 'finally'
$Container = 'finally'
$Volume = 'finally-data'
$Port = 8000

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path (Join-Path $Root '.env'))) {
    Copy-Item (Join-Path $Root '.env.example') (Join-Path $Root '.env') -ErrorAction Stop
    Write-Warning '.env not found; created it from .env.example.'
    Write-Warning 'Set OPENROUTER_API_KEY in .env for AI chat (chat returns an error until then).'
}

docker image inspect $Image *> $null
$imageExists = ($LASTEXITCODE -eq 0)

if ($Build -or -not $imageExists) {
    Write-Host "Building Docker image '$Image'..."
    docker build -t $Image $Root
    if ($LASTEXITCODE -ne 0) { throw 'docker build failed.' }
}

# Idempotent: replace any existing container (running or stopped).
docker container inspect $Container *> $null
if ($LASTEXITCODE -eq 0) {
    docker rm -f $Container *> $null
}

docker run -d `
    --name $Container `
    -v "${Volume}:/app/db" `
    -p "${Port}:8000" `
    --env-file (Join-Path $Root '.env') `
    $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'docker run failed.' }

Write-Host "FinAlly is running at http://localhost:$Port"
Write-Host 'Stop it with: scripts\stop_windows.ps1'
