# Kanban Board - Dev Services Startup Script
$ErrorActionPreference = "Continue"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Starting Kanban Board Development Stack  " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$env:PATH = "$env:USERPROFILE\scoop\shims;$env:USERPROFILE\scoop\apps\postgresql\18.6-5\pgsql\bin;$env:PATH"
$pgBin = "$env:USERPROFILE\scoop\apps\postgresql\18.6-5\pgsql\bin"
$pgData = "$env:USERPROFILE\scoop\apps\postgresql\18.6-5\data"
$pgLog = "$env:USERPROFILE\scoop\apps\postgresql\18.6-5\postgres.log"

# 1. PostgreSQL
Write-Host "[1/4] Checking PostgreSQL..." -ForegroundColor Yellow
$pgStatus = & "$pgBin\pg_isready.exe" -h localhost -p 5432 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Starting PostgreSQL on port 5432..." -ForegroundColor Yellow
    & "$pgBin\pg_ctl.exe" -D $pgData -l $pgLog start
    Start-Sleep -Seconds 2
} else {
    Write-Host "      PostgreSQL is already running." -ForegroundColor Green
}

# 2. Redis
Write-Host "[2/4] Checking Redis..." -ForegroundColor Yellow
$redisConn = Test-NetConnection -ComputerName localhost -Port 6379 -InformationLevel Quiet
if (-not $redisConn) {
    Write-Host "      Starting Redis on port 6379..." -ForegroundColor Yellow
    Start-Process -FilePath "redis-server.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 1
} else {
    Write-Host "      Redis is already running." -ForegroundColor Green
}

# 3. Backend (FastAPI)
Write-Host "[3/4] Starting FastAPI Backend on port 8000..." -ForegroundColor Yellow
$backendConn = Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet
if (-not $backendConn) {
    $backendCmd = @'
Set-Location "$PSScriptRoot\backend"
$env:PYTHONIOENCODING = "utf-8"
$env:DATABASE_URL = "postgresql+asyncpg://kanban:kanban_dev_password@localhost:5432/kanban_db"
$env:SESSION_SECRET_KEY = "dev-secret-key-change-in-production-must-be-32-chars"
$env:ALLOWED_ORIGINS = '["http://localhost:5173","http://localhost:3000"]'
$env:COOKIE_SECURE = "false"
$env:REDIS_URL = "redis://localhost:6379/0"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
'@
    $cmdBytes = [System.Text.Encoding]::Unicode.GetBytes($backendCmd)
    $encodedCmd = [Convert]::ToBase64String($cmdBytes)
    Start-Process powershell -ArgumentList "-EncodedCommand", $encodedCmd -WindowStyle Minimized
    Start-Sleep -Seconds 3
} else {
    Write-Host "      Backend is already running." -ForegroundColor Green
}

# 4. Frontend (Vite)
Write-Host "[4/4] Starting Vite Frontend on port 5173..." -ForegroundColor Yellow
$frontendConn = Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet
if (-not $frontendConn) {
    $frontendCmd = @'
Set-Location "$PSScriptRoot\frontend"
npm run dev -- --host 0.0.0.0 --port 5173
'@
    $cmdBytes = [System.Text.Encoding]::Unicode.GetBytes($frontendCmd)
    $encodedCmd = [Convert]::ToBase64String($cmdBytes)
    Start-Process powershell -ArgumentList "-EncodedCommand", $encodedCmd -WindowStyle Minimized
    Start-Sleep -Seconds 3
} else {
    Write-Host "      Frontend is already running." -ForegroundColor Green
}

Write-Host "`nAll services ready!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs: http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host "  Demo Owner:  demo_owner@kanban.dev  / DemoOwner123!" -ForegroundColor White
Write-Host "  Demo Member: demo_member@kanban.dev / DemoMember123!" -ForegroundColor White
