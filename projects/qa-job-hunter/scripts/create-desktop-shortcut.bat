@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "LAUNCHER=%~dp0launch-qa-job-hunter.bat"
for %%I in ("%~dp0..") do set "WORKDIR=%%~fI"

if not exist "%LAUNCHER%" (
  echo ERROR: No se encontro launch-qa-job-hunter.bat en scripts\
  pause
  exit /b 1
)

powershell -NoProfile -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "if (-not $desktop -or -not (Test-Path -LiteralPath $desktop)) { Write-Error ('Escritorio no encontrado: ' + $desktop); exit 1 };" ^
  "$shortcut = Join-Path $desktop 'QA Job Hunter.lnk';" ^
  "$s = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $s.CreateShortcut($shortcut);" ^
  "$lnk.TargetPath = '%LAUNCHER%';" ^
  "$lnk.WorkingDirectory = '%WORKDIR%';" ^
  "$lnk.IconLocation = '%SystemRoot%\System32\shell32.dll,167';" ^
  "$lnk.Description = 'QA Job Hunter launcher';" ^
  "$lnk.Save();" ^
  "Write-Output $shortcut"

if errorlevel 1 (
  echo ERROR: No se pudo crear el acceso directo.
  pause
  exit /b 1
)

echo.
echo   Acceso directo creado en tu Escritorio (OneDrive o local).
echo   Nombre: QA Job Hunter.lnk
echo.
echo   Doble clic para abrir el menu.
echo.
pause
