param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'backup-client.config.psd1')
)

$ErrorActionPreference = 'Stop'
$datedArtifactPattern = '^(sgc_completo_[0-9-]+(?:_[0-9-]+)?\.dump|sgc_integral_[0-9-]+_[0-9-]+\.siacbackup(?:\.sha256)?|siac_recovery_kit_[0-9-]+_[0-9-]+\.enc(?:\.sha256)?)$'
$recoveryHelperPattern = '^recuperar-siac\.sh(?:\.sha256)?$'

function Get-BackupDateFromName {
    param([string]$FileName)

    if ($FileName -match '^(?:sgc_completo|sgc_integral|siac_recovery_kit)_([0-9]{4}-[0-9]{2}-[0-9]{2})(?:_|-|\.)') {
        $parsedDate = [datetime]::MinValue
        if ([datetime]::TryParseExact($Matches[1], 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::None, [ref]$parsedDate)) {
            return $Matches[1]
        }
    }
    return $null
}

function Get-DateDirectories {
    param([string]$RootPath)

    return @(Get-ChildItem -LiteralPath $RootPath -Directory | Where-Object {
        $_.Name -match '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' -and (Get-BackupDateFromName "sgc_integral_$($_.Name)_00-00-00.siacbackup")
    })
}

function Move-LooseDatedArtifacts {
    param([string]$RootPath)

    Get-ChildItem -LiteralPath $RootPath -File | Where-Object { $_.Name -match $datedArtifactPattern } | ForEach-Object {
        $backupDate = Get-BackupDateFromName $_.Name
        if (-not $backupDate) { return }
        $dateDirectory = Join-Path $RootPath $backupDate
        New-Item -ItemType Directory -Path $dateDirectory -Force | Out-Null
        $targetPath = Join-Path $dateDirectory $_.Name
        if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
            Move-Item -LiteralPath $_.FullName -Destination $targetPath
            return
        }

        $sourceHash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) {
            throw "Existe un archivo diferente con el mismo nombre en $dateDirectory."
        }
        Remove-Item -LiteralPath $_.FullName -Force
    }
}

function Move-LooseRecoveryHelpers {
    param([string]$RootPath)

    $dateDirectories = Get-DateDirectories -RootPath $RootPath
    if ($dateDirectories.Count -eq 0) { return }
    Get-ChildItem -LiteralPath $RootPath -File | Where-Object { $_.Name -match $recoveryHelperPattern } | ForEach-Object {
        $sourcePath = $_.FullName
        foreach ($dateDirectory in $dateDirectories) {
            Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $dateDirectory.FullName $_.Name) -Force
        }
        Remove-Item -LiteralPath $sourcePath -Force
    }
}

function Test-DownloadedFile {
    param(
        [string]$FileName,
        [string]$FilePath
    )

    if ($FileName.EndsWith('.dump')) {
        $stream = [System.IO.File]::OpenRead($FilePath)
        try {
            $signatureBytes = New-Object byte[] 5
            $read = $stream.Read($signatureBytes, 0, 5)
        } finally {
            $stream.Dispose()
        }
        $signature = [System.Text.Encoding]::ASCII.GetString($signatureBytes)
        if ($read -ne 5 -or $signature -ne 'PGDMP') {
            throw "La copia $FileName no es un dump PostgreSQL valido."
        }
    } elseif ($FileName.EndsWith('.siacbackup')) {
        $entries = @(& tar -tf $FilePath)
        if ($LASTEXITCODE -ne 0) { throw "El paquete integral $FileName esta danado." }
        foreach ($required in @('manifest.json', 'database.dump', 'uploads.tar.gz')) {
            if ($entries -notcontains $required) { throw "Al paquete $FileName le falta $required." }
        }
    } elseif ($FileName.EndsWith('.enc') -and (Get-Item -LiteralPath $FilePath).Length -lt 32) {
        throw "El kit privado $FileName esta vacio o incompleto."
    } elseif ($FileName -eq 'recuperar-siac.sh') {
        $firstLine = Get-Content -LiteralPath $FilePath -TotalCount 1
        if ($firstLine -ne '#!/usr/bin/env bash') { throw 'El asistente de recuperacion no tiene una firma valida.' }
    }
}

function Receive-RemoteFile {
    param(
        [string]$FileName,
        [string]$FinalPath,
        [bool]$ReplaceExisting = $false
    )

    if ((Test-Path -LiteralPath $FinalPath -PathType Leaf) -and -not $ReplaceExisting) { return }
    $partialPath = "$FinalPath.partial"
    try {
        & scp @sshArguments "${remoteUserName}@${remoteHostName}:$remoteDirectory/$FileName" $partialPath
        if ($LASTEXITCODE -ne 0) { throw "No fue posible descargar $FileName" }
        Test-DownloadedFile -FileName $FileName -FilePath $partialPath
        Move-Item -LiteralPath $partialPath -Destination $FinalPath -Force
    } finally {
        if (Test-Path -LiteralPath $partialPath) {
            Remove-Item -LiteralPath $partialPath -Force
        }
    }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw 'No existe la configuracion privada del cliente de respaldos.'
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

# Las copias creadas con versiones anteriores se organizan antes de descargar las nuevas.
Move-LooseDatedArtifacts -RootPath $resolvedDestination
Move-LooseRecoveryHelpers -RootPath $resolvedDestination

$remoteTarget = "${remoteUserName}@${remoteHostName}"
$remoteFiles = @(& ssh @sshArguments $remoteTarget "find '$remoteDirectory' -maxdepth 1 -type f \( -name 'sgc_completo_*.dump' -o -name 'sgc_integral_*.siacbackup' -o -name 'sgc_integral_*.siacbackup.sha256' -o -name 'siac_recovery_kit_*.enc' -o -name 'siac_recovery_kit_*.enc.sha256' -o -name 'recuperar-siac.sh' -o -name 'recuperar-siac.sh.sha256' \) -printf '%f\n'")
if ($LASTEXITCODE -ne 0) {
    throw 'No fue posible consultar las copias disponibles en el servidor.'
}

$availableFiles = @($remoteFiles | ForEach-Object { ([string]$_).Trim() } | Where-Object {
    $_ -match $datedArtifactPattern -or $_ -match $recoveryHelperPattern
} | Select-Object -Unique)
$datedFiles = @($availableFiles | Where-Object { $_ -match $datedArtifactPattern })
$backupDates = @($datedFiles | ForEach-Object { Get-BackupDateFromName $_ } | Where-Object { $_ } | Sort-Object -Unique)

foreach ($cleanName in $datedFiles) {
    $backupDate = Get-BackupDateFromName $cleanName
    $dateDirectory = Join-Path $resolvedDestination $backupDate
    New-Item -ItemType Directory -Path $dateDirectory -Force | Out-Null
    Receive-RemoteFile -FileName $cleanName -FinalPath (Join-Path $dateDirectory $cleanName)
}

# El asistente comun se conserva dentro de cada paquete diario, nunca suelto en la raiz.
$helperFiles = @($availableFiles | Where-Object { $_ -match $recoveryHelperPattern })
$helperCacheDirectory = Join-Path $resolvedDestination ".backup-helper-sync-$PID"
if ($helperFiles.Count -gt 0) {
    New-Item -ItemType Directory -Path $helperCacheDirectory -Force | Out-Null
    try {
        foreach ($helperName in $helperFiles) {
            Receive-RemoteFile -FileName $helperName -FinalPath (Join-Path $helperCacheDirectory $helperName) -ReplaceExisting $true
        }
        foreach ($backupDate in $backupDates) {
            $dateDirectory = Join-Path $resolvedDestination $backupDate
            New-Item -ItemType Directory -Path $dateDirectory -Force | Out-Null
            foreach ($helperName in $helperFiles) {
                Copy-Item -LiteralPath (Join-Path $helperCacheDirectory $helperName) -Destination (Join-Path $dateDirectory $helperName) -Force
            }
        }
    } finally {
        if (Test-Path -LiteralPath $helperCacheDirectory -PathType Container) {
            Remove-Item -LiteralPath $helperCacheDirectory -Recurse -Force
        }
    }
}
$dateDirectories = Get-DateDirectories -RootPath $resolvedDestination

foreach ($dateDirectory in $dateDirectories) {
    Get-ChildItem -LiteralPath $dateDirectory.FullName -File | Where-Object {
        $_.Name -match '^(sgc_integral_.*\.siacbackup|siac_recovery_kit_.*\.enc|recuperar-siac\.sh)\.sha256$'
    } | ForEach-Object {
        $expected = ((Get-Content -LiteralPath $_.FullName -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
        $protectedPath = $_.FullName.Substring(0, $_.FullName.Length - '.sha256'.Length)
        if (Test-Path -LiteralPath $protectedPath -PathType Leaf) {
            $actual = (Get-FileHash -LiteralPath $protectedPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($actual -ne $expected) { throw "La huella del archivo no coincide: $protectedPath" }
        }
    }
}

if ($retentionDays -gt 0) {
    $cutoffDate = (Get-Date).Date.AddDays(-$retentionDays)
    foreach ($dateDirectory in (Get-DateDirectories -RootPath $resolvedDestination)) {
        $folderDate = [datetime]::ParseExact($dateDirectory.Name, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
        if ($folderDate -lt $cutoffDate) {
            Remove-Item -LiteralPath $dateDirectory.FullName -Recurse -Force
        }
    }
}
