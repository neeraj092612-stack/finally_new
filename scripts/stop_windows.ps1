# Stop FinAlly: removes the container and keeps the data volume (Windows PowerShell 5.1+).
# If script execution is blocked: powershell -ExecutionPolicy Bypass -File scripts\stop_windows.ps1

$Name = if ($env:FINALLY_CONTAINER) { $env:FINALLY_CONTAINER } else { 'finally-app' }
$Volume = if ($env:FINALLY_VOLUME) { $env:FINALLY_VOLUME } else { 'finally-data' }

# docker rm -f exits 0 for a missing container, so look first to report accurately.
$existing = docker ps -aq --filter "name=^$Name`$" 2>$null
if ($existing) {
    docker rm -f $Name *> $null
    Write-Host "Stopped $Name (data volume $Volume kept)."
} else {
    Write-Host "$Name is not running (data volume $Volume kept)."
}
exit 0
