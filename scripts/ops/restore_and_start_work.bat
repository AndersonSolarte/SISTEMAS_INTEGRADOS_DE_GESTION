@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "PROJECT_ROOT=%%~fI"

if "%~1"=="" (
  echo Uso:
  echo   %~nx0 ^<BUNDLE_DIR^> [DB_PORT] [PGPASSWORD]
  echo.
  echo Ejemplo:
  echo   %~nx0 "C:\laragon\www\SISTEMAS_INTEGRADOS_DE_GESTION\backups\work_bundle_20260302_223317" 5432 1234
  exit /b 1
)

set "BUNDLE_DIR=%~1"
set "DB_PORT=%~2"
if "%DB_PORT%"=="" set "DB_PORT=5432"
set "PGPASS=%~3"
if "%PGPASS%"=="" set "PGPASS=1234"

set "RESTORE_PS1=%SCRIPT_DIR%restore_on_work.ps1"

if not exist "%RESTORE_PS1%" (
  echo No existe: %RESTORE_PS1%
  exit /b 1
)

echo [1/3] Restaurando bundle en base sgc_db (puerto %DB_PORT%)...
powershell -ExecutionPolicy Bypass -File "%RESTORE_PS1%" ^
  -BundleDir "%BUNDLE_DIR%" ^
  -ProjectRoot "%PROJECT_ROOT%" ^
  -DbHost "localhost" ^
  -DbPort "%DB_PORT%" ^
  -DbUser "postgres" ^
  -DbName "sgc_db" ^
  -PgPassword "%PGPASS%"

if errorlevel 1 (
  echo Restore fallo. Revisa el error anterior.
  exit /b 1
)

echo [2/3] Iniciando backend en ventana separada...
start "SIG Backend" cmd /k "cd /d "%PROJECT_ROOT%\backend" && npm run dev"

echo [3/3] Iniciando frontend en ventana separada...
start "SIG Frontend" cmd /k "cd /d "%PROJECT_ROOT%\frontend" && npm start"

echo.
echo Listo. URLs esperadas:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000

endlocal
