@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -Command "$expected=[IO.Path]::GetFullPath('%~dp0').TrimEnd('\'); try {$h=Invoke-RestMethod -TimeoutSec 2 'http://127.0.0.1:3901/api/health'; $actual=[IO.Path]::GetFullPath([string]$h.app.project_root).TrimEnd('\'); if($h.status -eq 'ok' -and $actual -eq $expected){exit 0}; if($h.status -eq 'ok'){exit 2}} catch {}; exit 1" >nul 2>&1
if errorlevel 2 (
  echo Another EdgeView installation already owns port 3901.
  echo Close that EdgeView instance before starting this copy.
  exit /b 2
)
if not errorlevel 1 (
  start "" "http://127.0.0.1:3901"
  exit /b 0
)
node scripts\ensure-dependencies.mjs
if errorlevel 1 goto :error
node scripts\build-if-needed.mjs
if errorlevel 1 goto :error
echo Starting EdgeView at http://127.0.0.1:3901
set PORT=3901
set NODE_ENV=production
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$ready=$false; for($i=0;$i -lt 60;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:3901/api/health'; if($r.StatusCode -eq 200){$ready=$true;break}}catch{}; Start-Sleep -Milliseconds 250}; if($ready){Start-Process 'http://127.0.0.1:3901'}" >nul 2>&1
node dist\server.cjs
goto :eof
:error
echo.
echo EdgeView could not start. Review the message above.
pause
exit /b 1
