@echo off
REM ====================================================================
REM Jinay Finance AI — Windows Command Prompt Setup Script
REM ====================================================================

echo =======================================================
echo   JINAY FINANCE AI — WINDOWS SETUP
echo =======================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js v22 LTS from https://nodejs.org
    exit /b 1
)

if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] Created .env from .env.example
    )
)

if not exist node-backend\.env (
    if exist node-backend\.env.example (
        copy node-backend\.env.example node-backend\.env >nul
        echo [OK] Created node-backend\.env from node-backend\.env.example
    )
)

echo.
echo [*] Installing backend dependencies...
cd node-backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    cd ..
    exit /b 1
)

echo.
echo [*] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo [ERROR] Prisma generation failed.
    cd ..
    exit /b 1
)

cd ..

echo.
echo =======================================================
echo   SETUP COMPLETE!
echo   Run: npm run dev
echo =======================================================
