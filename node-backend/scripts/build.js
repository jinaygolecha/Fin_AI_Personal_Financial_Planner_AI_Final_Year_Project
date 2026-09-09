/**
 * FinPro Production Build Verification Script
 * Validates Prisma schema, generates Prisma Client, and verifies server entrypoints.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

// Ensure DATABASE_URL is available for Prisma schema validation during build
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/finance_jinay?schema=public';
}

console.log('[Build] Step 1/3: Validating Prisma Schema...');
try {
  execSync('npx prisma validate', { cwd: rootDir, stdio: 'inherit', env: process.env });
  console.log('  -> Prisma Schema is valid ✓');
} catch (err) {
  console.error('❌ Prisma Schema validation failed:', err.message);
  process.exit(1);
}

console.log('[Build] Step 2/3: Generating/Verifying Prisma Client...');
try {
  const { PrismaClient } = require('@prisma/client');
  new PrismaClient();
  console.log('  -> Prisma Client is compiled and verified active ✓');
} catch (err) {
  try {
    execSync('npx prisma generate', { cwd: rootDir, stdio: 'inherit' });
    console.log('  -> Prisma Client generated successfully ✓');
  } catch (genErr) {
    console.error('❌ Prisma Client generation failed:', genErr.message);
    process.exit(1);
  }
}

console.log('[Build] Step 3/3: Verifying Server Entrypoint and Public Frontend Assets...');
const serverFile = path.join(rootDir, 'src', 'server.js');
const appFile = path.join(rootDir, 'src', 'app.js');
const frontendIndex = path.resolve(rootDir, '../frontend/public/index.html');

if (!fs.existsSync(serverFile) || !fs.existsSync(appFile) || !fs.existsSync(frontendIndex)) {
  console.error('❌ Missing essential project entrypoints!');
  process.exit(1);
}

console.log('  -> Entrypoints and frontend assets present ✓');
console.log('\n[Build] ✅ Production build verification PASSED completely.\n');
process.exit(0);
