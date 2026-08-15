const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const legacyDir = path.join(rootDir, 'legacy-django-backend');

if (!fs.existsSync(legacyDir)) {
  fs.mkdirSync(legacyDir, { recursive: true });
}

const legacyItems = [
  'accounts',
  'admin_dashboard',
  'ai_engine',
  'analytics',
  'backend',
  'calendar_app',
  'group_expenses',
  'insights',
  'investments',
  'loans',
  'notifications',
  'payments',
  'planning',
  'transactions',
  'users',
  'static',
  'staticfiles',
  'categorizer_train.py',
  'celery_app.py',
  'manage.py',
  'transaction_classifier.pkl',
  'transaction_vectorizer.pkl',
  'transactions_dataset.csv',
  'requirements.txt',
  'backup.json',
  'backup.sql',
  'dump.rdb',
  'finance.sql',
  'python',
];

for (const item of legacyItems) {
  const src = path.join(rootDir, item);
  const dest = path.join(legacyDir, item);
  if (fs.existsSync(src)) {
    try {
      fs.renameSync(src, dest);
      console.log(`Archived: ${item} -> legacy-django-backend/${item}`);
    } catch (err) {
      console.error(`Failed to move ${item}:`, err.message);
    }
  }
}

console.log('Legacy Django archive completed successfully.');
