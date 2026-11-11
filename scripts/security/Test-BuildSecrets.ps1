param([string]$Root = (Join-Path $PSScriptRoot '../..'))

# Compara localmente el build con secretos del entorno. Nunca imprime sus valores.
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
$build = Join-Path $Root 'frontend/build'
if (-not (Test-Path -LiteralPath (Join-Path $build 'index.html'))) { throw 'Primero genere el build.' }
$secrets = @()
foreach ($relative in @('.env', '.env.local', 'backend/.env', 'backend/.env.local')) {
    $file = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    foreach ($line in [System.IO.File]::ReadLines($file)) {
        if ($line -notmatch '^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*)$') { continue }
        $name = $Matches[1]
        $value = $Matches[2].Trim().Trim([char[]]@('"', "'"))
        if ($name -match '^REACT_APP_' -or $name -notmatch '(SECRET|PASSWORD|TOKEN|API_KEY|SMTP_PASS|PRIVATE_KEY)$') { continue }
        if ($value.Length -lt 12 -or $value -match '(?i)replace|reemplaz|change.?me|cambiar|placeholder|^\$\{') { continue }
        $secrets += [pscustomobject]@{Name="$relative : $name";Value=$value}
    }
}
$failures = @()
Get-ChildItem -LiteralPath $build -File -Recurse | Where-Object { $_.Extension -match '^\.(js|css|json|html|txt)$' } | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName)
    foreach ($secret in $secrets) {
        if ($content.Contains($secret.Value)) {
            $failures += [pscustomobject]@{File=$_.Name;Variable=$secret.Name}
        }
    }
}
if ($failures.Count) {
    $failures | Format-Table -AutoSize
    throw 'El build contiene valores privados. No publicar.'
}
Write-Output "Build comprobado contra $($secrets.Count) valores privados locales: sin coincidencias."
