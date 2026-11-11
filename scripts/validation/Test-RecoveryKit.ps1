param(
    [string]$KitPath = 'D:\SIAC_COPIAS_DE_SEGURIDAD\2026-11-10\siac_recovery_kit_2026-11-10_18-20-02.enc',
    [string]$KeyPath = 'D:\SIAC_CLAVE_DE_RECUPERACION\backup-kit.key',
    [string]$OpenSslPath = 'C:\Users\adsolarte\AppData\Local\Programs\Git\mingw64\bin\openssl.exe'
)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$temporaryRoot = Join-Path $workspace 'tmp'
$work = Join-Path $temporaryRoot ('recovery-kit-validation-' + [guid]::NewGuid().ToString('N'))
$evidence = Join-Path $temporaryRoot 'release-validation\recovery-kit.json'
$result = @{ Passed=$false; SourceModified=$false; SecretValuesPrinted=$false }
New-Item -ItemType Directory -Path $work -Force | Out-Null
try {
    if (-not (Test-Path -LiteralPath $KitPath -PathType Leaf) -or -not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) { throw 'Falta el kit o la clave local.' }
    $checksum = "$KitPath.sha256"
    if (-not (Test-Path -LiteralPath $checksum -PathType Leaf)) { throw 'Falta la huella del kit.' }
    $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $KitPath -Algorithm SHA256).Hash -ne $expected) { throw 'La huella del kit no coincide.' }
    $archive = Join-Path $work 'private-kit.tar'
    & $OpenSslPath enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$KeyPath" -in $KitPath -out $archive 2> (Join-Path $work 'decrypt.log')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo descifrar el kit con la clave local.' }
    $entries = @(& tar -tf $archive)
    if ($LASTEXITCODE -ne 0) { throw 'El kit descifrado no es un archivo tar valido.' }
    if (@($entries | Where-Object { $_ -match '(^/|(^|/)\.\.(/|$)|\\)' }).Count) { throw 'El kit contiene rutas no permitidas.' }
    $types = @(& tar -tvf $archive)
    if ($LASTEXITCODE -ne 0 -or @($types | Where-Object { $_ -and $_[0] -notin @('-','d') }).Count) { throw 'El kit contiene enlaces o tipos de archivo no permitidos.' }
    foreach ($required in @('private/.env','private/docker-compose.yml','private/recovery-manifest.txt','private/source-code.tar.gz')) {
        if ($entries -notcontains $required) { throw 'Falta un componente de recuperacion en el kit.' }
    }
    & tar -xf $archive -C $work private/source-code.tar.gz
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar el codigo del kit.' }
    $sourceEntries = @(& tar -tzf (Join-Path $work 'private/source-code.tar.gz'))
    if ($LASTEXITCODE -ne 0) { throw 'El archivo de codigo esta incompleto.' }
    foreach ($required in @('backend/src/server.js','frontend/package.json','docker-compose.yml','scripts/backup/recover-siac-server.sh')) {
        if ($sourceEntries -notcontains $required) { throw 'El snapshot de codigo no contiene los componentes esperados.' }
    }
    $result.PrivateConfigurationIncluded=$true
    $result.SourceSnapshotIncluded=$true
    $result.SourceEntries=$sourceEntries.Count
    foreach ($required in @('private/fullchain.pem','private/Cert_planeacion.key')) {
        if ($entries -notcontains $required) { throw 'El kit no incluye el certificado TLS y su clave para recuperar HTTPS.' }
    }
    & tar -xf $archive -C $work private/fullchain.pem private/Cert_planeacion.key
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar el material TLS del kit.' }
    $certificate=Join-Path $work 'private/fullchain.pem'
    $privateKey=Join-Path $work 'private/Cert_planeacion.key'
    $certificatePublic=@(& $OpenSslPath x509 -in $certificate -pubkey -noout 2> (Join-Path $work 'tls.log'))
    if ($LASTEXITCODE -ne 0) { throw 'El certificado TLS del kit no es valido.' }
    $keyPublic=@(& $OpenSslPath pkey -in $privateKey -passin 'pass:' -pubout 2> (Join-Path $work 'key.log'))
    if ($LASTEXITCODE -ne 0 -or (($certificatePublic -join '') -replace '\s','') -ne (($keyPublic -join '') -replace '\s','')) { throw 'El certificado y la clave TLS del kit no coinciden.' }
    & $OpenSslPath x509 -in $certificate -checkend 0 -noout > (Join-Path $work 'expiry.log') 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'El certificado TLS guardado en el kit esta vencido.' }
    $result.TlsKeyMatchesCertificate=$true
    $result.TlsCertificateNotExpired=$true
    $result.Passed=$true
    Write-Output 'Kit cifrado: SHA-256 correcto, descifrado correcto, configuracion privada y snapshot de codigo presentes.'
    Write-Output 'HTTPS del kit: certificado vigente y clave privada coincidente, sin imprimir sus valores.'
} catch {
    $result.Passed=$false
    $result.Failure=$_.Exception.Message
    Write-Output ('Validacion del kit: ' + $result.Failure)
} finally {
    $target = (Resolve-Path -LiteralPath $work).Path
    $allowed = [System.IO.Path]::GetFullPath($temporaryRoot).TrimEnd('\') + '\'
    if (-not $target.StartsWith($allowed,[System.StringComparison]::OrdinalIgnoreCase) -or -not ([System.IO.Path]::GetFileName($target)).StartsWith('recovery-kit-validation-')) { throw 'Ruta temporal fuera del workspace.' }
    Remove-Item -LiteralPath $target -Recurse -Force
    $result.TemporaryPlaintextRemoved=$true
    $result | ConvertTo-Json | Set-Content -LiteralPath $evidence -Encoding UTF8
}
if (-not $result.Passed) { exit 1 }
