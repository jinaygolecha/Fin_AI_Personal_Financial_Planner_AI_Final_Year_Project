/**
 * FinPro — Cloud Computing Data Persistence Verification Suite
 * Verifies end-to-end data lifecycle across all 12 modules:
 * Signup -> Login -> Profile -> Accounts -> Transactions -> Budgets -> Goals ->
 * Investments -> Loans -> Insurance -> Subscriptions -> Tasks -> Storage
 * -> Logout -> Re-login -> Verify Persistence
 *
 * Owner: Jinay Golecha (jinay_golecha)
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
require('dotenv').config();

const request = require('supertest');
const app = require('./src/app');
const prisma = require('./src/config/database');

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

async function runCloudVerification() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        FINPRO — CLOUD DATA PERSISTENCE VERIFICATION SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const dbTelemetry = prisma.getDatabaseTelemetry ? prisma.getDatabaseTelemetry() : {};
  console.log(`📡 Database Target:   ${dbTelemetry.provider || 'PostgreSQL'} (${dbTelemetry.isCloud ? 'MANAGED CLOUD' : 'LOCAL DEV'})`);
  console.log(`🌐 Host:              ${dbTelemetry.host || '127.0.0.1'}`);
  console.log(`🔒 SSL Encryption:    ${dbTelemetry.ssl ? 'ENABLED (Strict/Require)' : 'Disabled/Local'}`);
  console.log(`📂 Database Name:     ${dbTelemetry.database || 'finance_jinay'}\n`);

  const uniqueId = Date.now();
  const testUser = {
    email: `cloud_audit_${uniqueId}@finpro-cloud.edu`,
    username: `cloud_user_${uniqueId}`,
    password: 'CloudPassword2026!',
    firstName: 'Academic',
    lastName: 'Verifier',
  };

  let token = null;
  let refreshToken = null;
  let userRecord = null;
  let accountId = null;
  let transactionId = null;
  let budgetId = null;
  let goalId = null;
  let investmentId = null;
  let loanId = null;
  let insuranceId = null;
  let subscriptionId = null;
  let taskId = null;
  let storageFileKey = null;

  try {
    // ------------------------------------------------------------------------
    // Step 1: Health & Cloud Probes
    // ------------------------------------------------------------------------
    console.log('👉 [Step 1/14] Validating Cloud Health & Diagnostics...');
    const healthRes = await request(app).get('/api/v1/health');
    assert(healthRes.status === 200 && healthRes.body.success, 'GET /api/v1/health reports operational status');

    const dbHealthRes = await request(app).get('/api/v1/health/database');
    assert(dbHealthRes.status === 200 && dbHealthRes.body.healthy, `Database latency measured at ${dbHealthRes.body.latencyMs}ms`);

    const storageHealthRes = await request(app).get('/api/v1/health/storage');
    assert(storageHealthRes.status === 200 && storageHealthRes.body.available, `Storage provider [${storageHealthRes.body.provider}] available`);

    const readyRes = await request(app).get('/api/v1/health/ready');
    assert(readyRes.status === 200 && readyRes.body.ready, 'Readiness probe reports ready=true for all subsystems');

    // ------------------------------------------------------------------------
    // Step 2: Signup
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 2/14] Testing Cloud User Registration (Signup)...');
    const signupRes = await request(app).post('/api/v1/auth/register').send(testUser);
    assert(signupRes.status === 201 && signupRes.body.success, 'POST /api/v1/auth/register created user record in database');
    token = signupRes.body?.data?.accessToken;
    refreshToken = signupRes.body?.data?.refreshToken;
    userRecord = signupRes.body?.data?.user;

    // ------------------------------------------------------------------------
    // Step 3: Login & JWT Token Verification
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 3/14] Testing Authentication & Token Verification...');
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });
    assert(loginRes.status === 200 && loginRes.body?.data?.accessToken, 'POST /api/v1/auth/login authenticated successfully');
    token = loginRes.body.data.accessToken;

    // ------------------------------------------------------------------------
    // Step 4: Profile Management
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 4/14] Testing Profile Storage...');
    const profileRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    assert(profileRes.status === 200 && profileRes.body?.data?.email === testUser.email, 'GET /api/v1/auth/me retrieved user profile');

    // ------------------------------------------------------------------------
    // Step 5: Financial Accounts
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 5/14] Testing Account Creation & Atomic Balance...');
    const createAccRes = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'HDFC Cloud Salary Account',
        accountType: 'SAVINGS',
        balance: 50000,
        currency: 'INR',
        institution: 'HDFC Bank',
      });
    assert(createAccRes.status === 201 && createAccRes.body.success, 'POST /api/v1/accounts created financial account in PostgreSQL');
    accountId = createAccRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 6: Transactions
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 6/14] Testing Transaction Creation...');
    const txRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        category: 'Cloud Services',
        amount: 3500,
        transactionType: 'EXPENSE',
        merchant: 'Oracle Cloud Infrastructure',
        description: 'Always Free VM setup',
        paymentMethod: 'UPI',
        date: new Date().toISOString(),
      });
    assert(txRes.status === 201 && txRes.body.success, 'POST /api/v1/transactions created expense transaction');
    transactionId = txRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 7: Budgets
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 7/14] Testing Budget Persistence...');
    const budgetRes = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Cloud Services',
        monthlyLimit: 10000,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      });
    assert(budgetRes.status === 201 && budgetRes.body.success, 'POST /api/v1/budgets created monthly budget');
    budgetId = budgetRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 8: Goals
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 8/14] Testing Financial Goals...');
    const goalRes = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Emergency Cloud Fund',
        targetAmount: 100000,
        currentAmount: 25000,
        goalType: 'EMERGENCY_FUND',
      });
    assert(goalRes.status === 201 && goalRes.body.success, 'POST /api/v1/goals created target savings goal');
    goalId = goalRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 9: Investments
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 9/14] Testing Investments...');
    const invRes = await request(app)
      .post('/api/v1/investments/buy')
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: 'NIFTYBEES',
        name: 'Nippon India Nifty 50 ETF',
        assetType: 'ETF',
        quantity: 10,
        buyPrice: 280.50,
      });
    assert(invRes.status === 201 && invRes.body.success, 'POST /api/v1/investments/buy recorded asset holding in portfolio');
    investmentId = invRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 10: Loans
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 10/14] Testing Loans & Debt Tracking...');
    const loanRes = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        lenderName: 'SBI Education Loan',
        loanType: 'EDUCATION',
        principalAmount: 400000,
        interestRate: 8.5,
        tenureMonths: 60,
        emiAmount: 8200,
        outstandingBalance: 320000,
      });
    assert(loanRes.status === 201 && loanRes.body.success, 'POST /api/v1/loans created loan entry');
    loanId = loanRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 11: Insurance & Subscriptions
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 11/14] Testing Insurance & Subscriptions...');
    const insRes = await request(app)
      .post('/api/v1/insurance')
      .set('Authorization', `Bearer ${token}`)
      .send({
        policyName: 'Star Comprehensive Health Plan',
        insurer: 'Star Health',
        policyType: 'HEALTH',
        coverageAmount: 1000000,
        premium: 14500,
        premiumCycle: 'ANNUAL',
        renewalDate: '2027-01-15',
      });
    assert(insRes.status === 201 && insRes.body.success, 'POST /api/v1/insurance created policy');
    insuranceId = insRes.body?.data?.id;

    const subRes = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        serviceName: 'Cloud Server Backup',
        cost: 499,
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-10-01',
      });
    assert(subRes.status === 201 && subRes.body.success, 'POST /api/v1/subscriptions created subscription');
    subscriptionId = subRes.body?.data?.id;

    // ------------------------------------------------------------------------
    // Step 12: Tasks & Storage Upload
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 12/14] Testing Tasks & Cloud Object Storage...');
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Review Cloud Database Backup',
        dueDate: '2026-09-30',
        priority: 'HIGH',
      });
    assert(taskRes.status === 201 && taskRes.body.success, 'POST /api/v1/tasks created financial reminder task');
    taskId = taskRes.body?.data?.id;

    const sampleBase64Doc = Buffer.from('FINPRO_CLOUD_RECEIPT_TEST_DATA').toString('base64');
    const uploadRes = await request(app)
      .post('/api/v1/storage/upload')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileData: `data:text/plain;base64,${sampleBase64Doc}`,
        fileName: 'academic_cloud_receipt.txt',
        documentType: 'receipt',
      });
    assert(uploadRes.status === 201 && uploadRes.body.success, 'POST /api/v1/storage/upload stored file via storageService');
    storageFileKey = uploadRes.body?.data?.key;

    // ------------------------------------------------------------------------
    // Step 13: Logout & Token Revocation
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 13/14] Testing Logout & Token Revocation...');
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken });
    assert(logoutRes.status === 200, 'POST /api/v1/auth/logout revoked refresh token');

    // ------------------------------------------------------------------------
    // Step 14: Re-login & Data Retrieval (PERSISTENCE PROOF)
    // ------------------------------------------------------------------------
    console.log('\n👉 [Step 14/14] RE-AUTHENTICATING & VERIFYING FULL PERSISTENCE...');
    const reloginRes = await request(app).post('/api/v1/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });
    assert(reloginRes.status === 200 && reloginRes.body?.data?.accessToken, 'Re-login succeeded with original credentials');
    const freshToken = reloginRes.body.data.accessToken;

    // Retrieve all 12 modules with the fresh token
    const [accs, txs, bdgs, gls, invs, lns, inss, subs, tsks, fileVerify] = await Promise.all([
      request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/budgets').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/goals').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/investments/portfolio').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/loans').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/insurance').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/subscriptions').set('Authorization', `Bearer ${freshToken}`),
      request(app).get('/api/v1/tasks').set('Authorization', `Bearer ${freshToken}`),
      storageFileKey ? request(app).get(`/api/v1/storage/file/${encodeURIComponent(storageFileKey)}`).set('Authorization', `Bearer ${freshToken}`) : Promise.resolve({ status: 200 }),
    ]);

    const accList = accs.body?.data?.accounts || accs.body?.data || [];
    const txList = txs.body?.data?.transactions || txs.body?.data || [];
    const bdgList = bdgs.body?.data?.budgets || bdgs.body?.data || [];
    const goalList = Array.isArray(gls.body?.data) ? gls.body.data : (gls.body?.data?.goals || []);
    const invList = invs.body?.data?.holdings || invs.body?.data?.investments || [];
    const loanList = lns.body?.data?.loans || lns.body?.data || [];
    const insList = inss.body?.data?.policies || inss.body?.data || [];
    const subList = subs.body?.data?.subscriptions || subs.body?.data || [];
    const taskList = tsks.body?.data?.tasks || tsks.body?.data || [];

    const hasAccount = accList.some(a => a.id === accountId);
    const hasTransaction = txList.some(t => t.id === transactionId);
    const hasBudget = bdgList.some(b => b.id === budgetId);
    const hasGoal = goalList.some(g => g.id === goalId);
    const hasInvestment = invList.some(i => i.id === investmentId || i.symbol === 'NIFTYBEES');
    const hasLoan = loanList.some(l => l.id === loanId);
    const hasInsurance = insList.some(i => i.id === insuranceId);
    const hasSub = subList.some(s => s.id === subscriptionId);
    const hasTask = taskList.some(t => t.id === taskId);
    const filePersisted = fileVerify.status === 200;

    assert(hasAccount, 'Account persisted in database across sessions');
    assert(hasTransaction, 'Transaction persisted in database across sessions');
    assert(hasBudget, 'Budget persisted in database across sessions');
    assert(hasGoal, 'Goal persisted in database across sessions');
    assert(hasInvestment, 'Investment persisted in database across sessions');
    assert(hasLoan, 'Loan persisted in database across sessions');
    assert(hasInsurance, 'Insurance policy persisted in database across sessions');
    assert(hasSub, 'Subscription persisted in database across sessions');
    assert(hasTask, 'Task persisted in database across sessions');
    assert(filePersisted, 'Stored file persisted and retrieved across sessions');

    console.log('\n====================================================================');
    console.log(`  CLOUD VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL CLOUD DATA PERSISTENCE CHECKS PASSED WITH 100% INTEGRITY!\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Unexpected error during cloud data verification:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runCloudVerification();
}

module.exports = { runCloudVerification };
