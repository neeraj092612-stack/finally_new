# Start FinAlly in Docker (Windows PowerShell 5.1+).
# -Build (or --build) is the only flag. FINALLY_CONTAINER, FINALLY_VOLUME and
# FINALLY_PORT override the container name, data volume and host port.
# If script execution is blocked: powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1
param(
    [switch]$Build,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

# Keep the default error preference: in PowerShell 5.1, stop-on-error turns native
# stderr output (docker) into terminating errors. Test $LASTEXITCODE instead.

foreach ($arg in $Rest) {
    if ($arg -eq '--build') {
        $Build = [switch]$true
    } else {
        [Console]::Error.WriteLine('Usage: scripts\start_windows.ps1 [-Build | --build]')
        exit 2
    }
}

Set-Location (Split-Path -Parent $PSScriptRoot)

$Image = 'finally'
$Name = if ($env:FINALLY_CONTAINER) { $env:FINALLY_CONTAINER } else { 'finally-app' }
$Volume = if ($env:FINALLY_VOLUME) { $env:FINALLY_VOLUME } else { 'finally-data' }
$Port = if ($env:FINALLY_PORT) { $env:FINALLY_PORT } else { '8000' }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    [Console]::Error.WriteLine('Docker CLI not found on PATH. Install Docker and try again.')
    exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    [Console]::Error.WriteLine('Docker daemon is not running. Start Docker and try again.')
    exit 1
}

if ($Build -or -not (docker images -q $Image)) {
    docker build -t $Image .
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Build first, then replace: a failed build must not take down a running app.
docker rm -f $Name *> $null

if (Test-Path .env) {
    $envArgs = @('--env-file', '.env')
} else {
    Write-Warning '.env not found - starting without it (the simulator works; AI chat will return llm_error until OPENROUTER_API_KEY is set). Copy .env.example to .env to configure.'
    $envArgs = @()
}

# Bound to loopback on purpose: the app has no authentication.
docker run -d --name $Name -v "${Volume}:/app/db" -p "127.0.0.1:${Port}:8000" @envArgs $Image | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$status = ''
for ($i = 0; $i -lt 60; $i++) {
    $status = (docker inspect -f '{{.State.Health.Status}}' $Name 2>$null)
    if ($status -eq 'healthy') { break }
    Start-Sleep -Seconds 1
}

if ($status -eq 'healthy') {
    Write-Host "FinAlly is running at http://localhost:$Port"
} else {
    Write-Host "FinAlly is starting at http://localhost:$Port (check: docker logs $Name)"
}
