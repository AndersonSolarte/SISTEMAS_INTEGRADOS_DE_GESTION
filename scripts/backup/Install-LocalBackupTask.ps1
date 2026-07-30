param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot 'backup-client.config.psd1')
)

$ErrorActionPreference = 'Stop'
$syncScript = Join-Path $PSScriptRoot 'Sync-ServerBackups.ps1'
if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw 'No se encontro el sincronizador de copias.'
}
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw 'Primero debe crear la configuracion privada del cliente.'
}

$taskName = 'SIAC - Descargar copias de seguridad'
$powerShellExe = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$syncScript`" -ConfigPath `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute $powerShellExe -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At '18:15'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Output 'Tarea local instalada para las 18:15 y configurada para ejecutarse al volver a estar disponible.'
