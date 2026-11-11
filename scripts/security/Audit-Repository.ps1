param([string]$Root = (Join-Path $PSScriptRoot '../..'))

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
$files = @(& git -c core.quotepath=false -C $Root ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'No fue posible inventariar los archivos del repositorio.' }
$findings = @()
$rules = @{
    'Clave privada' = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'
    'Token de proveedor' = '(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})'
    'Credencial en URL' = '(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s:/]+:[^\s@]{4,}@'
    'Secreto literal' = '(?i)(?:password|passwd|jwt_secret|client_secret|api_key|smtp_pass|private_key)\s*[:=]\s*["'']([^"''\r\n]{8,})["'']'
    'Secreto de entorno' = '(?i)^\s*[A-Z_0-9]*(?:PASSWORD|SECRET|REFRESH_TOKEN|API_KEY|SMTP_PASS|PRIVATE_KEY)\s*=\s*([^#\r\n]+)'
}
$placeholders = '(?i)^(?:$|(?:example|ejemplo|replace|reemplaz|change.?me|cambiar|your[_ -]|tu[_ -]|placeholder|dummy|test[-_]|prueba[-_]|dev_only|process\.env|\$\{|<|\[).*)$'
foreach ($relative in ($files | Sort-Object -Unique)) {
    $full = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    if ($relative -match '^(?:uploads/|backend/uploads(?:_private)?/)') {
        $findings += [pscustomobject]@{File=$relative;Line=0;Rule='Documento cargado en repositorio'}
    }
    if ($relative -match '(?i)(?:^|/)(?:\.env(?:\.(?!example$|.*\.example$)[^/]+)?|[^/]+\.(?:pem|key|p12|pfx|dump|siacbackup|enc))$' -and $relative -ne 'frontend/.env.production') {
        $findings += [pscustomobject]@{File=$relative;Line=0;Rule='Archivo privado o respaldo en entrega'}
    }
    if ($relative -notmatch '(?i)\.(?:[cm]?js|jsx|ts|tsx|json|md|txt|ps1|psd1|sh|sql|ya?ml|example|production|conf|html|py)$' -or (Get-Item -LiteralPath $full).Length -gt 4MB) { continue }
    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadLines($full)) {
        $lineNumber++
        foreach ($rule in $rules.GetEnumerator()) {
            foreach ($match in [regex]::Matches($line, $rule.Value)) {
                if ($rule.Key -eq 'Secreto literal' -and ($relative -match '\.test\.[cm]?js$' -or $match.Groups[1].Value -match $placeholders -or $match.Groups[1].Value -match '^\$[A-Z_][A-Z_0-9]*$')) { continue }
                if ($rule.Key -eq 'Secreto de entorno') {
                    if ($relative -notmatch '(?:^|/)\.env(?:\.[^/]+)?$|\.example$') { continue }
                    $candidate = $match.Groups[1].Value.Trim().Trim([char[]]@('"', "'"))
                    if ($candidate.Length -lt 8 -or $candidate -match $placeholders) { continue }
                }
                # Solo se emiten ubicaciones y tipo: nunca valores de credenciales.
                $findings += [pscustomobject]@{File=$relative;Line=$lineNumber;Rule=$rule.Key}
            }
        }
    }
}
$findings | Sort-Object File,Line,Rule -Unique | Format-Table -AutoSize
Write-Output "Archivos inventariados: $($files.Count). Hallazgos para revisar: $($findings.Count)."
if ($findings.Count) { exit 1 }
