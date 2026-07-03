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

set "SHORTCUT=%USERPROFILE%\Desktop\QA Job Hunter.lnk"

powershell -NoProfile -Command ^
  "$s = (New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath = '%LAUNCHER%';" ^
  "$s.WorkingDirectory = '%WORKDIR%';" ^
  "$s.IconLocation = '%SystemRoot%\System32\shell32.dll,167';" ^
  "$s.Description = 'QA Job Hunter — launcher';" ^
  "$s.Save()"

if errorlevel 1 (
  echo ERROR: No se pudo crear el acceso directo.
  pause
  exit /b 1
)

echo.
echo   Acceso directo creado:
echo   %SHORTCUT%
echo.
echo   Doble clic en "QA Job Hunter" del Escritorio para abrir el menu.
echo.
pause
