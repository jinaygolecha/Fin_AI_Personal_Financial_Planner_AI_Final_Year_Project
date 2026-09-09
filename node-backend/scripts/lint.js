/**
 * FinPro Code Quality & Syntax Lint Runner
 * Validates syntax of all backend and frontend JS files.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const frontendJsDir = path.resolve(rootDir, '../frontend/public/assets/js');

function getAllJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      getAllJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const filesToCheck = [
  ...getAllJsFiles(srcDir),
  ...getAllJsFiles(frontendJsDir),
];

console.log(`[Lint] Checking syntax across ${filesToCheck.length} JavaScript files...`);
let errors = 0;

for (const filePath of filesToCheck) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // If file contains ES module statements (import/export), use SourceTextModule if available or test parse
    if (/^\s*(import|export)\s/m.test(content)) {
      if (typeof vm.SourceTextModule === 'function') {
        new vm.SourceTextModule(content, { identifier: filePath });
      } else {
        // Fallback ES Module syntax test: wrap in async function or test via node --check
        const { execSync } = require('child_process');
        execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
      }
    } else {
      new vm.Script(content, { filename: filePath });
    }
  } catch (err) {
    console.error(`❌ Syntax Error in ${path.relative(rootDir, filePath)}:`, err.message);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n[Lint] ❌ Failed: Found ${errors} syntax errors.`);
  process.exit(1);
} else {
  console.log(`[Lint] ✅ All ${filesToCheck.length} files passed syntax validation cleanly.`);
  process.exit(0);
}
