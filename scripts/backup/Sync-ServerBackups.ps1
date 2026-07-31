param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'backup-client.config.psd1')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "No existe la configuracion privada del cliente de respaldos."
}

$config = Import-PowerShellDataFile -LiteralPath $ConfigPath
$remoteHostName = [string]$config.RemoteHost
$remoteUserName = [string]$config.RemoteUser
$remoteDirectory = [string]$config.RemoteDirectory
$identityFile = [string]$config.IdentityFile
$destination = [string]$config.Destination
$retentionDays = [int]$config.RetentionDays

if ($remoteHostName -notmatch '^[A-Za-z0-9._-]+$' -or $remoteUserName -notmatch '^[A-Za-z0-9._-]+$') {
    throw 'El servidor o el usuario SSH no tienen un formato valido.'
}
if ($remoteDirectory -notmatch '^/[A-Za-z0-9._/-]+$') {
    throw 'La ruta remota privada no tiene un formato valido.'
}
if ([string]::IsNullOrWhiteSpace($destination)) {
    throw 'Debe configurar la carpeta local de destino.'
}

New-Item -ItemType Directory -Path $destination -Force | Out-Null
$resolvedDestination = (Resolve-Path -LiteralPath $destination).Path
$sshArguments = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20')
if ($identityFile) {
    if (-not (Test-Path -LiteralPath $identityFile -PathType Leaf)) {
        throw 'No se encontro la llave SSH privada configurada.'
    }
    $sshArguments += @('-i', $identityFile)
}

$remoteTarget = "${remoteUserName}@${remoteHostName}"
$remoteFiles = @(& ssh @sshArguments $remoteTarget "find '$remoteDirectory' -maxdepth 1 -type f \( -name 'sgc_completo_*.dump' -o -name 'sgc_integral_*.siacbackup' -o -name 'sgc_integral_*.siacbackup.sha256' -o -name 'siac_recovery_kit_*.enc' -o -name 'siac_recovery_kit_*.enc.sha256' -o -name 'recuperar-siac.sh' -o -name 'recuperar-siac.sh.sha256' \) -printf '%f\n'")
if ($LASTEXITCODE -ne 0) {
    throw 'No fue posible consultar las copias disponibles en el servidor.'
}

foreach ($fileName in $remoteFiles) {
    $cleanName = ([string]$fileName).Trim()
    if ($cleanName -notmatch '^(sgc_completo_[0-9-]+(?:_[0-9-]+)?\.dump|sgc_integral_[0-9-]+_[0-9-]+\.siacbackup(?:\.sha256)?|siac_recovery_kit_[0-9-]+_[0-9-]+\.enc(?:\.sha256)?|recuperar-siac\.sh(?:\.sha256)?)$') { continue }

    $finalPath = Join-Path $resolvedDestination $cleanName
    if ((Test-Path -LiteralPath $finalPath -PathType Leaf) -and $cleanName -notlike 'recuperar-siac.sh*') { continue }

    $partialPath = "$finalPath.partial"
    try {
        & scp @sshArguments "${remoteUserName}@${remoteHostName}:$remoteDirectory/$cleanName" $partialPath
        if ($LASTEXITCODE -ne 0) { throw "No fue posible descargar $cleanName" }

        if ($cleanName.EndsWith('.dump')) {
            $stream = [System.IO.File]::OpenRead($partialPath)
            try {
                $signatureBytes = New-Object byte[] 5
                $read = $stream.Read($signatureBytes, 0, 5)
            } finally {
                $stream.Dispose()
            }
            $signature = [System.Text.Encoding]::ASCII.GetString($signatureBytes)
            if ($read -ne 5 -or $signature -ne 'PGDMP') {
                throw "La copia $cleanName no es un dump PostgreSQL valido."
            }
        } elseif ($cleanName.EndsWith('.siacbackup')) {
            $entries = @(& tar -tf $partialPath)
            if ($LASTEXITCODE -ne 0) { throw "El paquete integral $cleanName esta danado." }
            foreach ($required in @('manifest.json', 'database.dump', 'uploads.tar.gz')) {
                if ($entries -notcontains $required) { throw "Al paquete $cleanName le falta $required." }
            }
        } elseif ($cleanName.EndsWith('.enc') -and (Get-Item -LiteralPath $partialPath).Length -lt 32) {
            throw "El kit privado $cleanName esta vacio o incompleto."
        } elseif ($cleanName -eq 'recuperar-siac.sh') {
            $firstLine = Get-Content -LiteralPath $partialPath -TotalCount 1
            if ($firstLine -ne '#!/usr/bin/env bash') { throw 'El asistente de recuperación no tiene una firma válida.' }
        }

        Move-Item -LiteralPath $partialPath -Destination $finalPath -Force
    } finally {
        if (Test-Path -LiteralPath $partialPath) {
            Remove-Item -LiteralPath $partialPath -Force
        }
    }
}

Get-ChildItem -LiteralPath $resolvedDestination -File | Where-Object {
    $_.Name -match '^(sgc_integral_.*\.siacbackup|siac_recovery_kit_.*\.enc|recuperar-siac\.sh)\.sha256$'
} | ForEach-Object {
    $expected = ((Get-Content -LiteralPath $_.FullName -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
    $encryptedPath = $_.FullName.Substring(0, $_.FullName.Length - '.sha256'.Length)
    if (Test-Path -LiteralPath $encryptedPath -PathType Leaf) {
        $actual = (Get-FileHash -LiteralPath $encryptedPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { throw "La huella del kit privado no coincide: $encryptedPath" }
    }
}

if ($retentionDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$retentionDays)
    Get-ChildItem -LiteralPath $resolvedDestination -File |
        Where-Object { $_.Name -match '^(sgc_completo_.*\.dump|sgc_integral_.*\.siacbackup(?:\.sha256)?|siac_recovery_kit_.*\.enc(?:\.sha256)?)$' } |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force
}
