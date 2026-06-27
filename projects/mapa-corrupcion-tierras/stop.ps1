# Detiene la app Dash que escucha en el puerto indicado (default: 8050).
param(
    [int]$Port = 8050
)

$connections = netstat -ano | Select-String ":$Port\s+.*LISTENING"

if (-not $connections) {
    Write-Host "No hay ningún proceso escuchando en el puerto $Port."
    exit 0
}

$pids = $connections | ForEach-Object {
    ($_ -split '\s+')[-1]
} | Sort-Object -Unique

foreach ($pid in $pids) {
    if ($pid -eq "0") { continue }
    Write-Host "Deteniendo PID $pid (puerto $Port)..."
    taskkill /PID $pid /F /T 2>&1 | Out-Host
}

Start-Sleep -Milliseconds 500

$stillRunning = netstat -ano | Select-String ":$Port\s+.*LISTENING"
if ($stillRunning) {
    Write-Host "Advertencia: el puerto $Port sigue en uso." -ForegroundColor Yellow
    exit 1
}

Write-Host "Puerto $Port liberado."
