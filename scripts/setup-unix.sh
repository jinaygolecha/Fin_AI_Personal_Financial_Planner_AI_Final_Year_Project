#!/usr/bin/env bash
# ====================================================================
# Jinay Finance AI — macOS / Linux Setup Script
# ====================================================================

set -e

echo "======================================================="
echo "  JINAY FINANCE AI — UNIX SETUP"
echo "======================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v22 LTS."
    exit 1
fi

echo "✅ Node.js detected: $(node -v)"

# Copy environment files
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
fi

if [ ! -f node-backend/.env ] && [ -f node-backend/.env.example ]; then
    cp node-backend/.env.example node-backend/.env
    echo "✅ Created node-backend/.env from node-backend/.env.example"
fi

# Install dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd node-backend
npm install

# Generate Prisma Client
echo ""
echo "🔧 Generating Prisma client..."
npx prisma generate

cd ..

echo ""
echo "======================================================="
echo "  SETUP COMPLETE!"
echo "  Run: npm run dev"
echo "======================================================="
