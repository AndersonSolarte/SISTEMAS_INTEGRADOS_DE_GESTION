param(
  [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path $ProjectRoot
$backendEnv = Join-Path $root "backend/.env"
$frontendEnv = Join-Path $root "frontend/.env"
$serviceAccount = Join-Path $root "backend/keys/google-service-account.json"

if (!(Test-Path $backendEnv)) { throw "Falta backend/.env" }
if (!(Test-Path $frontendEnv)) { throw "Falta frontend/.env" }
if (!(Test-Path $serviceAccount)) { throw "Falta backend/keys/google-service-account.json" }

$cfg = @{}
Get-Content $backendEnv | ForEach-Object {
  if ($_ -match '^[A-Za-z_][A-Za-z0-9_]*=') {
    $k, $v = $_ -split '=', 2
    $cfg[$k] = $v.Trim('"')
  }
}

$dbHost = $cfg["DB_HOST"]
$dbPort = $cfg["DB_PORT"]
$dbUser = $cfg["DB_USER"]
$dbPass = $cfg["DB_PASSWORD"]
$dbName = $cfg["DB_NAME"]

if ([string]::IsNullOrWhiteSpace($dbName)) { throw "DB_NAME no definido en backend/.env" }

$pgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if (!(Test-Path $pgDump)) { throw "No se encontró pg_dump en $pgDump" }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$bundleDir = Join-Path $root "backups/work_bundle_$stamp"
New-Item -Path $bundleDir -ItemType Directory -Force | Out-Null

$env:PGPASSWORD = $dbPass
$dumpFile = Join-Path $bundleDir "sgc_db_unificada.sql"
& $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -F p -f $dumpFile

Copy-Item $backendEnv (Join-Path $bundleDir "backend.env")
Copy-Item $frontendEnv (Join-Path $bundleDir "frontend.env")
Copy-Item $serviceAccount (Join-Path $bundleDir "google-service-account.json")

$restoreGuide = @"
1) Crear base:
   createdb -h localhost -p 5433 -U postgres sgc_db

2) Restaurar dump:
   psql -h localhost -p 5433 -U postgres -d sgc_db -f sgc_db_unificada.sql

3) Copiar archivos:
   - backend.env -> backend/.env
   - frontend.env -> frontend/.env
   - google-service-account.json -> backend/keys/google-service-account.json

4) Instalar y levantar:
   cd backend && npm ci && npm run dev
   cd frontend && npm ci && npm start
"@

Set-Content -Path (Join-Path $bundleDir "README_RESTORE.txt") -Value $restoreGuide -Encoding UTF8

Write-Output "BUNDLE_CREATED=$bundleDir"
