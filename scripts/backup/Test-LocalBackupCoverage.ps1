param(
    [string]$BackupRoot = 'D:\SIAC_COPIAS_DE_SEGURIDAD',
    [datetime]$EndDate = ([System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow, 'SA Pacific Standard Time').Date.AddDays(-1)),
    [ValidateRange(1, 366)][int]$Days = 7
)

# Auditoria de solo lectura: nunca descarga, elimina ni restaura archivos.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
    throw 'No existe la carpeta local de respaldos.'
}
$hasFailures = $false
for ($offset = $Days - 1; $offset -ge 0; $offset--) {
    $day = $EndDate.Date.AddDays(-$offset).ToString('yyyy-MM-dd')
    $folder = Join-Path $BackupRoot $day
    $issues = @()
    $counts = @{}
    foreach ($pattern in @("sgc_integral_${day}_*.siacbackup", "siac_recovery_kit_${day}_*.enc")) {
        $artifacts = @()
        if (Test-Path -LiteralPath $folder -PathType Container) {
            $artifacts = @(Get-ChildItem -LiteralPath $folder -Filter $pattern -File)
        }
        $counts[$pattern] = $artifacts.Count
        if ($artifacts.Count -eq 0) { $issues += "Falta $pattern" }
        foreach ($artifact in $artifacts) {
            $checksum = "$($artifact.FullName).sha256"
            if ($artifact.Length -eq 0) { $issues += "Archivo vacio: $($artifact.Name)" }
            if (-not (Test-Path -LiteralPath $checksum -PathType Leaf)) {
                $issues += "Falta huella: $($artifact.Name)"
                continue
            }
            $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
            if ($expected -notmatch '^[a-fA-F0-9]{64}$') {
                $issues += "Huella invalida: $($artifact.Name)"
            } elseif ((Get-FileHash -LiteralPath $artifact.FullName -Algorithm SHA256).Hash -ne $expected) {
                $issues += "Huella diferente: $($artifact.Name)"
            }
        }
    }
    if ($issues.Count -gt 0) { $hasFailures = $true }
    [pscustomobject]@{
        Day = $day
        Integral = $counts["sgc_integral_${day}_*.siacbackup"]
        RecoveryKit = $counts["siac_recovery_kit_${day}_*.enc"]
        Status = $(if ($issues.Count -eq 0) { 'OK' } else { 'INCOMPLETO' })
        Details = $issues -join '; '
    }
}
if ($hasFailures) { exit 1 }
