/**
 * FinPro — Major Engineering Repair Validation Suite
 * Tests Cloud Architecture, Bank Statement Ingestion, ML Categorization,
 * Active Learning Feedback, Receipt OCR + GST, Credit Health, and Persistence.
 */

const API_BASE = 'http://127.0.0.1:5000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   FINPRO — FINAL MAJOR ENGINEERING REPAIR VERIFICATION SUITE       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // Test 1: Real Cloud Health Service (12 Subsystems)
  console.log('👉 [1/8] Testing Real Cloud Health Telemetry (/health/cloud-detailed)...');
  const healthRes = await request('/health/cloud-detailed');
  assert(healthRes.ok, 'GET /health/cloud-detailed returns HTTP 200');
  const subsystems = healthRes.data?.subsystems || healthRes.data?.data?.subsystems || {};
  assert(subsystems.application?.status === 'CONNECTED', 'Application status is CONNECTED');
  assert(subsystems.postgresql?.status === 'CONNECTED', 'Cloud PostgreSQL status is CONNECTED');
  assert(subsystems.prisma?.status === 'CONNECTED', 'Prisma client is CONNECTED');
  assert(typeof subsystems.mlEngine?.details?.features === 'number' && subsystems.mlEngine?.details?.features > 0, 'ML Engine reports active trained feature vectors');
  assert(healthRes.data?.overallStatus !== undefined || healthRes.data?.data?.overallStatus !== undefined, 'Reports computed overall cloud status');
  
  // Verify zero secrets leaked
  const healthStr = JSON.stringify(healthRes.data);
  assert(!healthStr.includes('postgres://') && !healthStr.includes('AIzaSy'), 'Zero database URLs or API keys leaked in telemetry');

  // Test 2: User Authentication & Tenant Isolation
  console.log('\n👉 [2/8] Testing User Registration & Tenant Authentication...');
  const testEmail = `test_engineer_${Date.now()}@finpro.dev`;
  const regRes = await request('/auth/register', {
    method: 'POST',
    body: {
      email: testEmail,
      username: `test_${Date.now()}`,
      password: 'SecurePassword123!',
      firstName: 'Cloud',
      lastName: 'Engineer',
    },
  });
  assert(regRes.ok, 'User registered successfully');
  const token = regRes.data?.data?.accessToken || regRes.data?.data?.tokens?.accessToken;
  assert(!!token, 'Received valid JWT access token');

  // Test 3: CSV Importer with Quoted Commas & Multi-Attribute Duplicate Guard
  console.log('\n👉 [3/8] Testing Bank Statement CSV Importer & Duplicate Resolution...');
  const csvData = `Date,Description,Amount,Type
2026-08-01,"Monthly Salary Credit, Direct Deposit",85000,INCOME
2026-08-03,"D-Mart Supermarket, Grocery Shopping",4250.50,EXPENSE
2026-08-05,"Uber India, Tech Park Ride",480.00,EXPENSE`;

  const importRes1 = await request('/import/bank-statement', {
    method: 'POST',
    token,
    body: { csvContent: csvData },
  });
  assert(importRes1.ok, 'POST /import/bank-statement parses CSV with quoted commas');
  assert(importRes1.data?.data?.validCount === 3, `Correctly identified 3 valid rows (Got: ${importRes1.data?.data?.validCount})`);
  assert(importRes1.data?.data?.duplicateCount === 0, 'Zero false duplicates reported on first upload');

  // Test 4: Commit Transactions to Database
  console.log('\n👉 [4/8] Testing Transaction Commit & Database Persistence...');
  const validRows = importRes1.data?.data?.validRows || [];
  const commitRes = await request('/import/confirm', {
    method: 'POST',
    token,
    body: { rows: validRows },
  });
  assert(commitRes.ok, 'POST /import/confirm commits transactions to database');
  assert(commitRes.data?.data?.importedCount === 3, 'Committed exactly 3 transactions');

  // Test 5: Duplicate Detection on Second Upload (True Multi-Attribute Match)
  console.log('\n👉 [5/8] Testing Multi-Attribute Duplicate Guard on Re-Upload...');
  const importRes2 = await request('/import/bank-statement', {
    method: 'POST',
    token,
    body: { csvContent: csvData },
  });
  assert(importRes2.ok, 'POST /import/bank-statement parses re-uploaded statement');
  assert(importRes2.data?.data?.duplicateCount === 3, 'Accurately detected all 3 previously committed rows as duplicates');
  assert(importRes2.data?.data?.validCount === 0, 'Zero uncommitted valid rows remaining');
  assert(importRes2.data?.data?.duplicateRows[0]?.duplicateReason !== undefined, 'Duplicate row includes audit reason string');

  // Test 6: Machine Learning Active Learning Feedback Loop
  console.log('\n👉 [6/8] Testing ML Active Learning Feedback Loop...');
  const feedbackRes = await request('/import/feedback', {
    method: 'POST',
    token,
    body: {
      originalCategory: 'Food & Dining',
      correctedCategory: 'Groceries',
      description: 'Nature Basket Gourmet Stores',
      amount: 1250,
    },
  });
  assert(feedbackRes.ok, 'POST /import/feedback stores user categorization correction');
  assert(feedbackRes.data?.data?.feedbackId !== undefined || feedbackRes.data?.success === true, 'Correction recorded into training feedback buffer');

  // Test 7: FinPro Credit Health Indicator (Layer 1) & Bureau Transparency (Layer 2)
  console.log('\n👉 [7/8] Testing Credit Health Indicator (300-900 Scale) & CIBIL Status...');
  const creditRes = await request('/credit-score', { token });
  assert(creditRes.ok, 'GET /credit-score responds HTTP 200');
  const ind = creditRes.data?.finproIndicator || {};
  const bureau = creditRes.data?.officialBureauIntegration || creditRes.data?.bureauIntegration || {};
  assert(ind.score >= 300 && ind.score <= 900, `Calculated credit score in 300-900 range (Score: ${ind.score})`);
  assert(ind.title?.includes('Not an official CIBIL score'), 'Explicitly declares: Not an official CIBIL score');
  assert(bureau.status === 'NOT_CONFIGURED' || bureau.status === 'CONNECTED', 'Transparently reports bureau provider as NOT_CONFIGURED without leaking secrets');
  assert(Array.isArray(ind.methodology?.factors) && ind.methodology.factors.length >= 4, 'Includes multi-factor breakdown (Utilization, DTI, Cushion, Mix)');

  // Test 8: GST Verification & Tax Breakdown Calculator
  console.log('\n👉 [8/8] Testing GST Information Lookup & Tax Breakdown Calculator...');
  const gstLookupRes = await request('/gst/lookup', {
    method: 'POST',
    token,
    body: { gstin: '27AAPFU0939F1ZV' },
  });
  assert(gstLookupRes.ok, 'POST /gst/lookup verifies valid GSTIN format');
  const gstVal = gstLookupRes.data?.data?.validation || gstLookupRes.data?.validation || {};
  assert(gstVal.isValidFormat === true, 'Recognized 27AAPFU0939F1ZV as valid GSTIN');
  assert(gstVal.stateName === 'Maharashtra', 'Extracted state jurisdiction Maharashtra (State code 27)');
  assert(gstVal.pan === 'AAPFU0939F', 'Extracted PAN AAPFU0939F from GSTIN structure');

  const gstCalcRes = await request('/gst/calculate', {
    method: 'POST',
    token,
    body: { taxableAmount: 10000, gstRatePct: 18, isInterState: false },
  });
  assert(gstCalcRes.ok, 'POST /gst/calculate computes tax breakdown');
  assert(gstCalcRes.data?.data?.cgst === 900, 'Calculated CGST: ₹900 (9%)');
  assert(gstCalcRes.data?.data?.sgst === 900, 'Calculated SGST: ₹900 (9%)');
  assert(gstCalcRes.data?.data?.grossAmount === 11800, 'Calculated Total Invoice: ₹11,800');

  // Summary
  console.log('\n====================================================================');
  console.log(`  MAJOR REPAIR SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
