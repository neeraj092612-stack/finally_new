# Stop and remove the FinAlly container (Windows PowerShell). The finally-data volume is kept.
$Container = 'finally'

docker container inspect $Container *> $null
if ($LASTEXITCODE -eq 0) {
    docker rm -f $Container *> $null
    Write-Host "FinAlly stopped. Data is kept in the 'finally-data' volume."
} else {
    Write-Host 'FinAlly is not running.'
}
