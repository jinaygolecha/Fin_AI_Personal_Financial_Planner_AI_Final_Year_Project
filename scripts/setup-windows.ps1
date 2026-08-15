# ====================================================================
# Jinay Finance AI — Windows PowerShell Setup Script
# ====================================================================

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  JINAY FINANCE AI — WINDOWS ENVIRONMENT SETUP         " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js v22 LTS from https://nodejs.org" -ForegroundColor Red
    exit 1
}
$nodeVer = node -v
Write-Host "✅ Node.js detected: $nodeVer" -ForegroundColor Green

# 2. Environment file check
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Created .env from .env.example" -ForegroundColor Green
    }
}
if (-not (Test-Path "node-backend\.env")) {
    if (Test-Path "node-backend\.env.example") {
        Copy-Item "node-backend\.env.example" "node-backend\.env"
        Write-Host "✅ Created node-backend\.env from node-backend\.env.example" -ForegroundColor Green
    }
}

# 3. Install Dependencies
Write-Host "`n📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "node-backend"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install npm dependencies." -ForegroundColor Red
    Set-Location ..
    exit 1
}

# 4. Generate Prisma Client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client." -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE! RUN THE APPLICATION:               " -ForegroundColor Green
Write-Host "  npm run dev       (Start development server)        " -ForegroundColor Cyan
Write-Host "  npm test          (Run acceptance test suite)       " -ForegroundColor Cyan
Write-Host "  npm run db:seed   (Seed sample demo data)           " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Green
