const { execSync } = require('child_process');
const fs = require('fs');

const trackedFiles = execSync('git ls-files', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const suspicious = [];

const secretPatterns = [
  /AIza[0-9A-Za-z-_]{35}/,                  // Google API key pattern
  /sk-[a-zA-Z0-9]{20,}/,                   // OpenAI API key
  /ghp_[a-zA-Z0-9]{20,}/,                   // GitHub Personal Access Token
  /AKIA[0-9A-Z]{16}/,                       // AWS Access Key ID
  /-----BEGIN [A-Z]+ PRIVATE KEY-----/,     // Private encryption keys
];

for (const file of trackedFiles) {
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.webp') || 
      file.endsWith('.ico') || file.endsWith('.pkl') || file.endsWith('.rdb') ||
      file.endsWith('.csv')) continue;
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const pat of secretPatterns) {
    if (pat.test(content)) {
      suspicious.push({ file, pattern: pat.toString() });
      break;
    }
  }
}

console.log('Tracked files scanned:', trackedFiles.length);
console.log('Suspicious files found:', suspicious.length);
if (suspicious.length > 0) {
  suspicious.forEach(s => console.log(' - ' + s.file + ' (pattern: ' + s.pattern + ')'));
} else {
  console.log('✅ SECRETS AUDIT: PASS (0 exposed secrets found across tracked files)');
}
