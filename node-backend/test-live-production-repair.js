/**
 * FinPro — Production Repair E2E Verification Suite
 * Verifies live Supabase connectivity, authentication, registration,
 * tenant isolation, transaction lifecycle, and persistence on Render.
 */

const https = require('https');

const BASE_URL = 'https://finpro-finance-ai-olvt.onrender.com';

function apiRequest(endpoint, { method = 'GET', body = null, token = null } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
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
  console.log('\n====================================================================');
  console.log('   FINPRO LIVE PRODUCTION VERIFICATION SUITE');
  console.log(`   Target: ${BASE_URL}`);
  console.log('====================================================================\n');

  // TEST 1: Health check
  console.log('👉 [1/8] Verifying Live Health & Database Connectivity...');
  const healthRes = await apiRequest('/api/v1/health');
  assert(healthRes.status === 200, 'GET /api/v1/health returns HTTP 200');
  assert(healthRes.data?.success === true, 'Health check reports success: true');
  assert(healthRes.data?.database === 'connected', 'Database reported status is "connected"');
  assert(healthRes.data?.databaseTier === 'cloud', 'Database tier is "cloud" (Supabase)');
  assert(typeof healthRes.data?.databaseLatencyMs === 'number', `Database latency measured: ${healthRes.data?.databaseLatencyMs}ms`);

  // TEST 2: Invalid Login Rejection
  console.log('\n👉 [2/8] Testing Invalid Credentials Rejection...');
  const invalidLogin = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'nonexistent_user@example.com', password: 'WrongPassword123!' },
  });
  assert(invalidLogin.status === 401, 'POST /api/v1/auth/login returns HTTP 401 for invalid credentials');
  assert(invalidLogin.data?.error?.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS');
  assert(invalidLogin.data?.error?.message === 'Invalid email/username or password.', 'Error message is "Invalid email/username or password."');

  // TEST 3: User Registration (User A)
  console.log('\n👉 [3/8] Testing User Registration End-to-End...');
  const timestamp = Date.now();
  const userA = {
    email: `prod_test_a_${timestamp}@example.com`,
    username: `prod_user_a_${timestamp}`,
    password: `TestPassword@${timestamp}`,
    firstName: 'Production',
    lastName: 'TesterA',
  };
  const regRes = await apiRequest('/api/v1/auth/register', { method: 'POST', body: userA });
  assert(regRes.status === 201, 'POST /api/v1/auth/register returns HTTP 201 Created');
  assert(regRes.data?.success === true, 'Registration reports success: true');
  assert(!!regRes.data?.data?.accessToken, 'Access token generated on registration');
  assert(!!regRes.data?.data?.refreshToken, 'Refresh token generated on registration');
  assert(regRes.data?.data?.user?.email === userA.email, 'Registered user email matches');
  const tokenA = regRes.data?.data?.accessToken;
  const refreshTokenA = regRes.data?.data?.refreshToken;
  const userIdA = regRes.data?.data?.user?.id;

  // TEST 4: Duplicate Email Rejection
  console.log('\n👉 [4/8] Testing Duplicate Email Rejection...');
  const dupRes = await apiRequest('/api/v1/auth/register', { method: 'POST', body: userA });
  assert(dupRes.status === 409, 'Duplicate registration returns HTTP 409 Conflict');
  assert(dupRes.data?.error?.code === 'EMAIL_EXISTS', 'Duplicate error code is EMAIL_EXISTS');

  // TEST 5: User Login with Password Verification
  console.log('\n👉 [5/8] Testing User Login & Password Hash Verification...');
  const loginRes = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email: userA.email, password: userA.password },
  });
  assert(loginRes.status === 200, 'POST /api/v1/auth/login returns HTTP 200 for valid user');
  assert(loginRes.data?.success === true, 'Login reports success: true');
  assert(loginRes.data?.data?.user?.id === userIdA, 'Logged in user ID matches registered user ID');
  const sessionTokenA = loginRes.data?.data?.accessToken;

  // TEST 6: Protected Route Access & Profile
  console.log('\n👉 [6/8] Testing Protected API Route & Tenant Context...');
  const meRes = await apiRequest('/api/v1/auth/me', { token: sessionTokenA });
  assert(meRes.status === 200, 'GET /api/v1/auth/me returns HTTP 200');
  assert(meRes.data?.data?.id === userIdA, 'Profile user ID matches session');

  // TEST 7: Synthetic Transaction Creation & Retrieval
  console.log('\n👉 [7/8] Testing Synthetic Transaction Creation & Retrieval...');
  const accountsRes = await apiRequest('/api/v1/accounts', { token: sessionTokenA });
  let accountsList = accountsRes.data?.data?.accounts || accountsRes.data?.data || [];
  let primaryAccount = accountsList[0];

  if (!primaryAccount?.id) {
    const createAccRes = await apiRequest('/api/v1/accounts', {
      method: 'POST',
      token: sessionTokenA,
      body: {
        name: 'Primary Checking',
        accountType: 'BANK',
        institution: 'HDFC Bank',
        balance: 10000.0,
      },
    });
    assert(createAccRes.status === 201, 'POST /api/v1/accounts created primary account (HTTP 201)');
    primaryAccount = createAccRes.data?.data;
  }
  assert(!!primaryAccount?.id, 'User has an active account ID for transaction posting');

  const txRes = await apiRequest('/api/v1/transactions', {
    method: 'POST',
    token: sessionTokenA,
    body: {
      accountId: primaryAccount.id,
      amount: 450.75,
      type: 'EXPENSE',
      category: 'FOOD_AND_DINING',
      description: 'Production Verification Lunch',
      date: new Date().toISOString(),
    },
  });
  assert(txRes.status === 201, 'POST /api/v1/transactions created transaction (HTTP 201)');
  const txId = txRes.data?.data?.id;

  const getTxRes = await apiRequest('/api/v1/transactions', { token: sessionTokenA });
  const txList = getTxRes.data?.data?.transactions || getTxRes.data?.data || [];
  const foundTx = txList.find(t => t.id === txId);
  assert(!!foundTx, 'Transaction successfully retrieved from Supabase');
  assert(parseFloat(foundTx?.amount) === 450.75, 'Transaction amount persists accurately (450.75)');

  // TEST 8: Tenant Isolation (User B cannot see User A's transaction)
  console.log('\n👉 [8/8] Testing Tenant Isolation Between Two Users...');
  const userB = {
    email: `prod_test_b_${timestamp}@example.com`,
    username: `prod_user_b_${timestamp}`,
    password: `TestPassword@${timestamp}`,
    firstName: 'Production',
    lastName: 'TesterB',
  };
  const regB = await apiRequest('/api/v1/auth/register', { method: 'POST', body: userB });
  const tokenB = regB.data?.data?.accessToken;

  const txBRes = await apiRequest('/api/v1/transactions', { token: tokenB });
  const userBTransactions = txBRes.data?.data?.transactions || txBRes.data?.data || [];
  const leakedTx = userBTransactions.find(t => t.id === txId);
  assert(!leakedTx, 'Tenant Isolation PASS: User B cannot access User A transaction');

  console.log('\n====================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
