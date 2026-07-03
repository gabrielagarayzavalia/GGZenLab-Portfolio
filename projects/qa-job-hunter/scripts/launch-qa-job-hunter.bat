@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0.."
cd /d "%ROOT%"
set "LAUNCHER_STARTED_MONGO="

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ERROR: Node.js no esta instalado o no esta en el PATH.
  echo   Instalalo desde https://nodejs.org
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ERROR: npm no esta en el PATH.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo   AVISO: No hay node_modules. Usa la opcion 13 del menu para setup inicial.
  echo.
)

if not exist ".env" (
  echo.
  echo   AVISO: No hay .env — LinkedIn requiere LI_EMAIL y LI_PASS.
  echo   Copia .env.example a .env y completa tus credenciales.
  echo.
)

:menu
cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║              QA JOB HUNTER — Launcher                      ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo   Carpeta: %CD%
echo.
echo   [1]  Pipeline completo (login + scrape + analisis)
echo   [2]  Scrape + Analisis Ollama
echo   [3]  Scrape + Analisis Claude API
echo   [4]  Scrape + Exportar para Claude.ai
echo   [5]  Solo login LinkedIn
echo   [6]  Solo scrape
echo   [7]  Solo analisis (requiere scrape previo)
echo   [8]  Dashboard web (http://localhost:3847)
echo   [9]  MongoDB — levantar
echo   [10] MongoDB — detener
echo   [11] Seed Mongo
echo   [12] Tests API (requiere dashboard activo)
echo   [13] Setup inicial (npm install + Playwright)
echo   [0]  Salir
echo.
set /p OPCION="  Elegi una opcion: "

if "%OPCION%"=="1" goto opt_full_run
if "%OPCION%"=="2" goto opt_scrape_ollama
if "%OPCION%"=="3" goto opt_scrape_claude
if "%OPCION%"=="4" goto opt_scrape_export
if "%OPCION%"=="5" goto opt_login
if "%OPCION%"=="6" goto opt_scrape_only
if "%OPCION%"=="7" goto opt_analyze_menu
if "%OPCION%"=="8" goto opt_dashboard
if "%OPCION%"=="9" goto opt_mongo_up
if "%OPCION%"=="10" goto opt_mongo_down
if "%OPCION%"=="11" goto opt_seed
if "%OPCION%"=="12" goto opt_test_api
if "%OPCION%"=="13" goto opt_setup
if "%OPCION%"=="0" goto cleanup
echo   Opcion invalida.
timeout /t 2 >nul
goto menu

:opt_full_run
echo.
echo   Pipeline completo: login si hace falta, scrape y analisis interactivo...
call npm run full-run
if errorlevel 1 goto menu_fail
goto after_pipeline

:opt_scrape_ollama
echo.
echo   Scrape LinkedIn y analisis con Ollama...
call npm run scrape
if errorlevel 1 goto menu_fail
set "LLM_PROVIDER=ollama"
call npm run analyze
if errorlevel 1 goto menu_fail
goto after_pipeline

:opt_scrape_claude
echo.
echo   Scrape LinkedIn y analisis con Claude API...
call npm run scrape
if errorlevel 1 goto menu_fail
set "LLM_PROVIDER=anthropic"
call npm run analyze
if errorlevel 1 goto menu_fail
goto after_pipeline

:opt_scrape_export
echo.
echo   Scrape LinkedIn y exportacion para Claude.ai...
call npm run scrape
if errorlevel 1 goto menu_fail
call npx tsx src/4-export-for-chat.ts
if errorlevel 1 goto menu_fail
goto menu_done

:opt_login
echo.
echo   Login LinkedIn (guarda sesion para proximos usos)...
call npm run login
if errorlevel 1 goto menu_fail
goto menu_done

:opt_scrape_only
echo.
echo   Solo scraping LinkedIn...
call npm run scrape
if errorlevel 1 goto menu_fail
goto menu_done

:opt_analyze_menu
cls
echo.
echo   Solo analisis — requiere empleos ya scrapeados
echo.
echo   [1] Ollama (local)
echo   [2] Claude API (nube)
echo   [3] Exportar para Claude.ai
echo   [0] Volver al menu
echo.
set /p ANALYZE_OPT="  Elegi: "
if "%ANALYZE_OPT%"=="0" goto menu
if "%ANALYZE_OPT%"=="1" goto analyze_ollama
if "%ANALYZE_OPT%"=="2" goto analyze_claude
if "%ANALYZE_OPT%"=="3" goto analyze_export
echo   Opcion invalida.
timeout /t 2 >nul
goto opt_analyze_menu

:analyze_ollama
set "LLM_PROVIDER=ollama"
call npm run analyze
if errorlevel 1 goto menu_fail
goto after_pipeline

:analyze_claude
set "LLM_PROVIDER=anthropic"
call npm run analyze
if errorlevel 1 goto menu_fail
goto after_pipeline

:analyze_export
call npx tsx src/4-export-for-chat.ts
if errorlevel 1 goto menu_fail
goto menu_done

:opt_dashboard
echo.
echo   Dashboard en http://localhost:3847 — Ctrl+C para cerrar y salir.
call :ensure_port_free 3847
if errorlevel 1 goto menu
call npm run dashboard
goto cleanup

:opt_mongo_up
echo.
echo   Levantando MongoDB (docker compose)...
docker compose up -d
if errorlevel 1 goto menu_fail
set "LAUNCHER_STARTED_MONGO=1"
docker compose ps
goto menu_done

:opt_mongo_down
echo.
echo   Deteniendo MongoDB...
docker compose down
goto menu_done

:opt_seed
echo.
echo   Seed Mongo desde output/jobs-result.json...
call npm run db:seed
if errorlevel 1 goto menu_fail
goto menu_done

:opt_test_api
echo.
echo   Tests API — el dashboard debe estar corriendo en :3847
call npm run test:api
if errorlevel 1 goto menu_fail
goto menu_done

:opt_setup
echo.
echo   Instalando dependencias y Chromium para Playwright...
call npm install
if errorlevel 1 goto menu_fail
call npx playwright install chromium
if errorlevel 1 goto menu_fail
goto menu_done

:after_pipeline
echo.
echo   Pipeline terminado.
echo.
echo   [D] Abrir dashboard (http://localhost:3847)
echo   [S] Salir
choice /c DS /n /m "  Elegi opcion: "
if errorlevel 2 goto cleanup
call :ensure_port_free 3847
if errorlevel 1 goto menu
call npm run dashboard
goto cleanup

:menu_fail
echo.
echo   El comando termino con error.
goto menu_done

:menu_done
echo.
pause
goto menu

:ensure_port_free
call :port_in_use %~1
if errorlevel 1 exit /b 0
echo.
echo   El puerto %~1 ya esta en uso.
choice /c SL /n /m "  [S] Liberar puerto  [L] Cancelar: "
if errorlevel 2 exit /b 1
call :kill_port %~1
exit /b 0

:port_in_use
netstat -ano | findstr ":%~1" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:kill_port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%~1" ^| findstr "LISTENING"') do (
  if not "%%p"=="0" taskkill /PID %%p /F >nul 2>&1
)
exit /b 0

:cleanup
echo.
echo   Cerrando procesos del QA Job Hunter...
call :kill_port 3847
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*qa-job-hunter*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'chromium.exe') -and $_.CommandLine -like '*playwright*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
if "%LAUNCHER_STARTED_MONGO%"=="1" (
  echo   Deteniendo MongoDB iniciado en esta sesion...
  docker compose down >nul 2>&1
)
echo   Listo.
timeout /t 2 >nul
exit /b 0
