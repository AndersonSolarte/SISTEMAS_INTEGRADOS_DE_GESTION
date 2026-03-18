param(
  [Parameter(Mandatory = $true)]
  [string]$BundleDir,
  [string]$ProjectRoot = ".",
  [string]$DbHost = "localhost",
  [string]$DbPort = "5433",
  [string]$DbUser = "postgres",
  [string]$DbName = "sgc_db",
  [string]$PgPassword = "",
  [string]$PostgresBin = "C:\Program Files\PostgreSQL\18\bin",
  [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"

$bundle = Resolve-Path $BundleDir
$root = Resolve-Path $ProjectRoot

$sqlFile = Join-Path $bundle "sgc_db_unificada.sql"
$backendEnvSrc = Join-Path $bundle "backend.env"
$frontendEnvSrc = Join-Path $bundle "frontend.env"
$googleKeySrc = Join-Path $bundle "google-service-account.json"

if (!(Test-Path $sqlFile)) { throw "No existe $sqlFile" }
if (!(Test-Path $backendEnvSrc)) { throw "No existe $backendEnvSrc" }
if (!(Test-Path $frontendEnvSrc)) { throw "No existe $frontendEnvSrc" }
if (!(Test-Path $googleKeySrc)) { throw "No existe $googleKeySrc" }

$psql = Join-Path $PostgresBin "psql.exe"
if (!(Test-Path $psql)) { throw "No existe psql.exe en $PostgresBin" }

$createdb = Join-Path $PostgresBin "createdb.exe"
if (!(Test-Path $createdb)) { throw "No existe createdb.exe en $PostgresBin" }

$dropdb = Join-Path $PostgresBin "dropdb.exe"
if (!(Test-Path $dropdb)) { throw "No existe dropdb.exe en $PostgresBin" }

if (![string]::IsNullOrWhiteSpace($PgPassword)) {
  $env:PGPASSWORD = $PgPassword
}

Write-Host "1/6 Terminando conexiones activas a $DbName..."
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();"

Write-Host "2/6 Recreando base $DbName..."
& $dropdb -h $DbHost -p $DbPort -U $DbUser --if-exists $DbName
& $createdb -h $DbHost -p $DbPort -U $DbUser $DbName

Write-Host "3/6 Restaurando dump SQL..."
& $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $sqlFile

Write-Host "4/6 Copiando archivos de configuracion..."
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$keysDir = Join-Path $backendDir "keys"
if (!(Test-Path $keysDir)) {
  New-Item -Path $keysDir -ItemType Directory -Force | Out-Null
}

Copy-Item $backendEnvSrc (Join-Path $backendDir ".env") -Force
Copy-Item $frontendEnvSrc (Join-Path $frontendDir ".env") -Force
Copy-Item $googleKeySrc (Join-Path $keysDir "google-service-account.json") -Force

Write-Host "5/6 Verificando conteos clave..."
$validationQuery = @"
SELECT 'users='||COUNT(*) FROM users;
SELECT 'user_module_permissions='||COUNT(*) FROM user_module_permissions;
SELECT 'documento_favoritos='||COUNT(*) FROM documento_favoritos;
"@
& $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -At -c $validationQuery

if ($InstallDependencies) {
  Write-Host "6/6 Instalando dependencias (npm ci backend/frontend)..."
  Push-Location (Join-Path $root "backend")
  npm ci
  Pop-Location

  Push-Location (Join-Path $root "frontend")
  npm ci
  Pop-Location
} else {
  Write-Host "6/6 Dependencias no instaladas (usa -InstallDependencies si quieres automatizarlo)."
}

Write-Host ""
Write-Host "Restauracion completa. Ya puedes iniciar:"
Write-Host "  backend:  cd backend && npm run dev"
Write-Host "  frontend: cd frontend && npm start"
