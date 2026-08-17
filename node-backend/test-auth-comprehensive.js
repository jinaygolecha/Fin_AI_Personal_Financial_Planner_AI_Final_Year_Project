/**
 * Jinay Finance AI — Comprehensive Authentication & Security Test Suite
 * Owner: Jinay Golecha (jinay_golecha)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('./src/app');
const prisma = require('./src/config/database');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runAuthTests() {
  console.log('\n====================================================================');
  console.log('  JINAY FINANCE AI — COMPREHENSIVE AUTHENTICATION & SECURITY AUDIT');
  console.log('====================================================================\n');

  const timestamp = Date.now();
  const userAData = {
    firstName: 'Jinay',
    lastName: 'Golecha',
    username: `jinay_auth_${timestamp}`,
    email: `jinay_auth_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    firstName: 'Tenant',
    lastName: 'Two',
    username: `tenant_b_${timestamp}`,
    email: `tenant_b_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let tokenA = null;
  let refreshTokenA = null;
  let userAId = null;

  let tokenB = null;
  let userBId = null;

  try {
    // 1. Health & Auth Status Check
    console.log('👉 [1/9] Testing Auth Health & Status...');
    const healthAuth = await request(app).get('/api/v1/health/auth');
    assert(healthAuth.status === 200 && healthAuth.body.success === true, 'GET /api/v1/health/auth returns 200 OK');
    assert(healthAuth.body.database === 'healthy', 'Database status reports healthy');
    assert(healthAuth.body.jwt === 'configured', 'JWT configuration verified');

    // 2. Signup / Registration Validation Matrix
    console.log('\n👉 [2/9] Testing Registration Validation Matrix...');
    // Empty fields
    const emptyReg = await request(app).post('/api/v1/auth/register').send({});
    assert(emptyReg.status === 400 && emptyReg.body.error.code === 'VALIDATION_ERROR', 'Rejects empty registration with 400');

    // Weak password
    const weakReg = await request(app).post('/api/v1/auth/register').send({
      email: `weak_${timestamp}@example.com`,
      username: `weak_${timestamp}`,
      password: '123',
    });
    assert(weakReg.status === 400 && weakReg.body.error.code === 'WEAK_PASSWORD', 'Rejects weak password (<8 chars) with 400');

    // Valid registration
    const validRegA = await request(app).post('/api/v1/auth/register').send(userAData);
    assert(validRegA.status === 201 && validRegA.body.success === true, 'Registers new user with 201 Created');
    assert(validRegA.body.data.user && validRegA.body.data.user.email === userAData.email.toLowerCase(), 'Returns sanitized user without password');
    assert(!validRegA.body.data.user.password, 'Password hash is NOT exposed in response');
    assert(validRegA.body.data.accessToken && validRegA.body.data.refreshToken, 'Returns valid access and refresh token pair');

    userAId = validRegA.body.data.user.id;
    tokenA = validRegA.body.data.accessToken;
    refreshTokenA = validRegA.body.data.refreshToken;

    // Duplicate email check
    const dupReg = await request(app).post('/api/v1/auth/register').send(userAData);
    assert(dupReg.status === 409 && dupReg.body.error.code === 'EMAIL_EXISTS', 'Rejects exact duplicate email with 409 EMAIL_EXISTS');

    // Case-insensitive email duplicate check (e.g. JINAY_AUTH_...@example.com)
    const upperDupReg = await request(app).post('/api/v1/auth/register').send({
      ...userAData,
      email: userAData.email.toUpperCase(),
      username: `different_username_${timestamp}`,
    });
    assert(upperDupReg.status === 409 && upperDupReg.body.error.code === 'EMAIL_EXISTS', 'Rejects uppercase duplicate email with 409 EMAIL_EXISTS');

    // 3. PostgreSQL Database Persistence & Security
    console.log('\n👉 [3/9] Testing PostgreSQL User Persistence & Password Hashing...');
    const dbUser = await prisma.user.findUnique({
      where: { id: userAId },
      include: { profile: true, financialProfile: true, accounts: true },
    });
    assert(dbUser !== null, 'User is persisted in PostgreSQL "users" table');
    assert(dbUser.email === userAData.email.toLowerCase(), 'Email is normalized to lowercase in database');
    assert(dbUser.password.startsWith('$2a$') || dbUser.password.startsWith('$2b$'), 'Password is encrypted using strong bcrypt hash');
    assert(bcrypt.compareSync(userAData.password, dbUser.password), 'bcrypt hash correctly verifies against plaintext password');
    assert(dbUser.profile !== null, 'User profile relation automatically created');
    assert(dbUser.accounts.length >= 1, 'Primary financial account automatically created');

    // 4. Login Matrix
    console.log('\n👉 [4/9] Testing Login Matrix...');
    // Valid login
    const validLogin = await request(app).post('/api/v1/auth/login').send({
      email: userAData.email,
      password: userAData.password,
    });
    assert(validLogin.status === 200 && validLogin.body.success === true, 'Login with correct email and password succeeds');
    assert(validLogin.body.data.accessToken && validLogin.body.data.refreshToken, 'Login returns tokens');

    // Login with username instead of email
    const usernameLogin = await request(app).post('/api/v1/auth/login').send({
      emailOrUsername: userAData.username,
      password: userAData.password,
    });
    assert(usernameLogin.status === 200 && usernameLogin.body.success === true, 'Login with username succeeds');

    // Login with uppercase email
    const upperLogin = await request(app).post('/api/v1/auth/login').send({
      email: userAData.email.toUpperCase(),
      password: userAData.password,
    });
    assert(upperLogin.status === 200, 'Login with uppercase email succeeds due to normalization');

    // Wrong password
    const wrongPassLogin = await request(app).post('/api/v1/auth/login').send({
      email: userAData.email,
      password: 'IncorrectPassword999!',
    });
    assert(wrongPassLogin.status === 401 && wrongPassLogin.body.error.code === 'INVALID_CREDENTIALS', 'Rejects wrong password with 401');

    // Non-existent email
    const unknownUserLogin = await request(app).post('/api/v1/auth/login').send({
      email: `non_existent_${timestamp}@example.com`,
      password: 'Password123!',
    });
    assert(unknownUserLogin.status === 401 && unknownUserLogin.body.error.code === 'INVALID_CREDENTIALS', 'Rejects non-existent email with generic 401');

    // 5. JWT Authentication & /auth/me
    console.log('\n👉 [5/9] Testing JWT Authentication & /auth/me...');
    // Valid token
    const meValid = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenA}`);
    assert(meValid.status === 200 && meValid.body.data.id === userAId, 'GET /api/v1/auth/me returns authenticated user object');

    // No token
    const meNoToken = await request(app).get('/api/v1/auth/me');
    assert(meNoToken.status === 401 && meNoToken.body.error.code === 'UNAUTHORIZED', 'GET /api/v1/auth/me without token returns 401 UNAUTHORIZED');

    // Invalid token
    const meBadToken = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid.token.value');
    assert(meBadToken.status === 401 && meBadToken.body.error.code === 'INVALID_TOKEN', 'GET /api/v1/auth/me with malformed token returns 401 INVALID_TOKEN');

    // Expired token simulation
    const expiredToken = jwt.sign({ userId: userAId }, process.env.JWT_SECRET, { expiresIn: '-10s' });
    const meExpired = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expiredToken}`);
    assert(meExpired.status === 401 && meExpired.body.error.code === 'TOKEN_EXPIRED', 'GET /api/v1/auth/me with expired token returns 401 TOKEN_EXPIRED');

    // 6. Refresh Token & Logout Flow
    console.log('\n👉 [6/9] Testing Refresh Token & Logout Flow...');
    // Valid refresh
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refreshTokenA });
    assert(refreshRes.status === 200 && refreshRes.body.data.accessToken, 'POST /api/v1/auth/refresh generates fresh access token');
    const newAccessToken = refreshRes.body.data.accessToken;
    const newRefreshToken = refreshRes.body.data.refreshToken;

    // Use new access token
    const meNewToken = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${newAccessToken}`);
    assert(meNewToken.status === 200, 'New access token functions for protected routes');

    // Logout
    const logoutRes = await request(app).post('/api/v1/auth/logout').send({ refreshToken: newRefreshToken });
    assert(logoutRes.status === 200, 'POST /api/v1/auth/logout successfully revokes refresh token');

    // Refresh after logout should fail
    const revokedRefresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: newRefreshToken });
    assert(revokedRefresh.status === 401 && revokedRefresh.body.error.code === 'TOKEN_REVOKED', 'Revoked refresh token rejected with 401 TOKEN_REVOKED');

    // 7. CSV Export Authentication
    console.log('\n👉 [7/9] Testing Export Authentication (Bearer & Query Token)...');
    // Export with Bearer header
    const exportBearer = await request(app).get('/api/v1/export/transactions.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(exportBearer.status === 200 && exportBearer.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with Bearer header succeeds (200 CSV)');

    // Export with Query token
    const exportQuery = await request(app).get(`/api/v1/export/transactions.csv?token=${encodeURIComponent(tokenA)}`);
    assert(exportQuery.status === 200 && exportQuery.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with Query token succeeds (200 CSV)');

    // Export without token
    const exportNoAuth = await request(app).get('/api/v1/export/transactions.csv');
    assert(exportNoAuth.status === 401, 'GET /api/v1/export/transactions.csv without token returns 401');

    // 8. Multi-User Tenant Isolation
    console.log('\n👉 [8/9] Testing Multi-User Tenant Isolation (User A vs User B)...');
    const validRegB = await request(app).post('/api/v1/auth/register').send(userBData);
    userBId = validRegB.body.data.user.id;
    tokenB = validRegB.body.data.accessToken;

    // User A creates transaction of ₹10,000
    const txA = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 10000, type: 'EXPENSE', category: 'Rent & Housing', description: 'User A Rent' });
    assert(txA.status === 201, 'User A creates ₹10,000 transaction');
    const txAId = txA.body.data.id;

    // User B creates transaction of ₹5,000
    const txB = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ amount: 5000, type: 'EXPENSE', category: 'Food & Dining', description: 'User B Food' });
    assert(txB.status === 201, 'User B creates ₹5,000 transaction');

    // User A reads transactions
    const listA = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${tokenA}`);
    const descriptionsA = listA.body.data.transactions.map(t => t.description);
    assert(descriptionsA.includes('User A Rent') && !descriptionsA.includes('User B Food'), 'User A only sees User A transactions');

    // User B reads transactions
    const listB = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${tokenB}`);
    const descriptionsB = listB.body.data.transactions.map(t => t.description);
    assert(descriptionsB.includes('User B Food') && !descriptionsB.includes('User A Rent'), 'User B only sees User B transactions');

    // User B attempts to access User A transaction directly by ID
    const accessCross = await request(app).get(`/api/v1/transactions/${txAId}`).set('Authorization', `Bearer ${tokenB}`);
    assert(accessCross.status === 404, 'User B cannot access User A transaction by ID (returns 404 Not Found)');

    // 9. Google OAuth Configuration Handling
    console.log('\n👉 [9/9] Testing Google OAuth Configuration Handling...');
    const googleRedirect = await request(app).get('/api/v1/auth/google');
    // If not configured, should return 503 GOOGLE_NOT_CONFIGURED or redirect to Google if configured
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com') {
      assert(googleRedirect.status === 302 && googleRedirect.headers.location.includes('accounts.google.com'), 'Google OAuth configured and redirects to accounts.google.com');
    } else {
      assert(googleRedirect.status === 503, 'Unconfigured Google OAuth cleanly reports 503 GOOGLE_NOT_CONFIGURED without faking');
    }

    console.log('\n====================================================================');
    console.log(`  AUTHENTICATION AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================================\n');

  } catch (err) {
    console.error('Fatal error during auth test run:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAuthTests();
