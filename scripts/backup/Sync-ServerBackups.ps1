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
$remoteFiles = @(& ssh @sshArguments $remoteTarget "find '$remoteDirectory' -maxdepth 1 -type f -name 'sgc_completo_*.dump' -printf '%f\n'")
if ($LASTEXITCODE -ne 0) {
    throw 'No fue posible consultar las copias disponibles en el servidor.'
}

foreach ($fileName in $remoteFiles) {
    $cleanName = ([string]$fileName).Trim()
    if ($cleanName -notmatch '^sgc_completo_[0-9-]+_[0-9-]+\.dump$') { continue }

    $finalPath = Join-Path $resolvedDestination $cleanName
    if (Test-Path -LiteralPath $finalPath -PathType Leaf) { continue }

    $partialPath = "$finalPath.partial"
    try {
        & scp @sshArguments "${remoteUserName}@${remoteHostName}:$remoteDirectory/$cleanName" $partialPath
        if ($LASTEXITCODE -ne 0) { throw "No fue posible descargar $cleanName" }

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

        Move-Item -LiteralPath $partialPath -Destination $finalPath
    } finally {
        if (Test-Path -LiteralPath $partialPath) {
            Remove-Item -LiteralPath $partialPath -Force
        }
    }
}

if ($retentionDays -gt 0) {
    $cutoff = (Get-Date).AddDays(-$retentionDays)
    Get-ChildItem -LiteralPath $resolvedDestination -File -Filter 'sgc_completo_*.dump' |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force
}
