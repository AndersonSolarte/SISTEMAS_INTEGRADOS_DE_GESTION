param([string]$NodePath = 'node')
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $workspace
try {
    & powershell.exe -NoProfile -File scripts/security/Audit-Repository.ps1
    if ($LASTEXITCODE -ne 0) { throw 'La revision del repositorio no fue aprobada.' }
    & $NodePath frontend/scripts/verify-build.cjs
    if ($LASTEXITCODE -ne 0) { throw 'El build no es publicable.' }
    & powershell.exe -NoProfile -File scripts/security/Test-BuildSecrets.ps1
    if ($LASTEXITCODE -ne 0) { throw 'La comprobacion de secretos del build fallo.' }
    & $NodePath scripts/release/prepare-release.cjs
    if ($LASTEXITCODE -ne 0) { throw 'La preparacion de la entrega no fue aprobada.' }
} finally { Pop-Location }
