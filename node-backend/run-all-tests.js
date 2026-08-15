/**
 * Jinay Finance AI — Comprehensive Production Acceptance Test Suite
 * Owner: Jinay Golecha (jinay_golecha)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const request = require('supertest');
const app = require('./src/app');
const prisma = require('./src/config/database');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  JINAY FINANCE AI — MASTER END-TO-END ACCEPTANCE SUITE');
  console.log('======================================================\n');

  let userA, tokenA, userB, tokenB;
  let accountAId, txAIncomeId, txAExpenseId, budgetAId, goalAId, loanAId, invAId, policyAId, subAId;

  const testUserA = {
    email: `jinay_test_a_${Date.now()}@example.com`,
    username: `jinay_a_${Date.now()}`,
    password: 'Password123!',
    firstName: 'Jinay',
    lastName: 'Golecha',
  };

  const testUserB = {
    email: `jinay_test_b_${Date.now()}@example.com`,
    username: `user_b_${Date.now()}`,
    password: 'Password123!',
    firstName: 'Other',
    lastName: 'User',
  };

  try {
    // 1. Health Endpoints
    console.log('👉 [1/15] Testing Health & Diagnostic Endpoints...');
    const health = await request(app).get('/api/v1/health');
    assert(health.status === 200 && health.body.success === true && health.body.database === 'connected', 'GET /api/v1/health returns success and connected database');

    const dbHealth = await request(app).get('/api/v1/health/database');
    assert(dbHealth.status === 200 && dbHealth.body.status === 'connected', 'GET /api/v1/health/database confirms PostgreSQL connectivity');

    const aiHealth = await request(app).get('/api/v1/health/ai');
    assert(aiHealth.status === 200 && aiHealth.body.provider === 'Google Gemini', 'GET /api/v1/health/ai returns AI provider status');

    const marketHealth = await request(app).get('/api/v1/health/market');
    assert(marketHealth.status === 200 && marketHealth.body.provider === 'Finnhub', 'GET /api/v1/health/market returns Finnhub status');

    // 2. Authentication Flow
    console.log('\n👉 [2/15] Testing Centralized Authentication Flow...');
    const regA = await request(app).post('/api/v1/auth/register').send(testUserA);
    assert(regA.status === 201 && regA.body.success === true, 'POST /api/v1/auth/register creates new user with profiles and primary account');
    userA = regA.body.data.user;
    tokenA = regA.body.data.accessToken;

    const dupReg = await request(app).post('/api/v1/auth/register').send(testUserA);
    assert(dupReg.status === 409, 'POST /api/v1/auth/register rejects duplicate registration with 409');

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: testUserA.email, password: testUserA.password });
    assert(loginA.status === 200 && loginA.body.data.accessToken, 'POST /api/v1/auth/login succeeds with valid credentials');
    tokenA = loginA.body.data.accessToken;

    const badLogin = await request(app).post('/api/v1/auth/login').send({ email: testUserA.email, password: 'WrongPassword!' });
    assert(badLogin.status === 401, 'POST /api/v1/auth/login returns 401 on wrong password');

    const meA = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${tokenA}`);
    assert(meA.status === 200 && meA.body.data.email === testUserA.email, 'GET /api/v1/auth/me returns authenticated user details');

    // Register User B
    const regB = await request(app).post('/api/v1/auth/register').send(testUserB);
    userB = regB.body.data.user;
    tokenB = regB.body.data.accessToken;
    assert(regB.status === 201, 'Registered User B for tenant isolation testing');

    // 3. Onboarding
    console.log('\n👉 [3/15] Testing Financial Onboarding...');
    const onb = await request(app)
      .post('/api/v1/onboarding')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        age: 24,
        city: 'Mumbai',
        monthlySalary: 100000,
        estimatedMonthlyExpenses: 30000,
        currentSavings: 50000,
        totalDebt: 0,
        riskProfile: 'MODERATE',
        budgetMethod: 'FIFTY_THIRTY_TWENTY',
        financialPriorities: 'Save for home, emergency fund',
      });
    assert(onb.status === 200 && onb.body.data.isOnboardingComplete === true, 'POST /api/v1/onboarding calculates financial health score & 50/30/20 plan');

    const onbStat = await request(app).get('/api/v1/onboarding/status').set('Authorization', `Bearer ${tokenA}`);
    assert(onbStat.status === 200 && onbStat.body.data.isOnboardingComplete === true, 'GET /api/v1/onboarding/status returns complete');

    // 4. Accounts & Deposits (Atomic)
    console.log('\n👉 [4/15] Testing Accounts & Deposit Atomicity...');
    const accs = await request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${tokenA}`);
    assert(accs.status === 200 && accs.body.data.accounts.length > 0, 'GET /api/v1/accounts lists user accounts');
    accountAId = accs.body.data.accounts[0].id;

    const depositRes = await request(app)
      .post(`/api/v1/accounts/${accountAId}/deposit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 100000, source: 'Salary', description: 'Monthly income credit' });
    assert(depositRes.status === 200 && depositRes.body.data.newBalance >= 100000, 'POST /api/v1/accounts/:id/deposit adds ₹1,00,000 atomically with income record');
    txAIncomeId = depositRes.body.data.transactionId;

    // 5. Dashboard Aggregations
    console.log('\n👉 [5/15] Testing Real-time Dashboard Aggregations...');
    const dash = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${tokenA}`);
    assert(dash.status === 200 && dash.body.data.monthlyIncome >= 100000, 'GET /api/v1/dashboard calculates Monthly Income from DB');
    assert(dash.body.data.totalBalance >= 100000, 'GET /api/v1/dashboard reflects total balance from DB');
    assert(typeof dash.body.data.financialHealthScore === 'number', 'GET /api/v1/dashboard calculates Financial Health Score');

    // 6. Transactions & Reversals
    console.log('\n👉 [6/15] Testing Transactions CRUD, Anomaly Detection & Reversals...');
    const addExpense = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        amount: 20000,
        type: 'EXPENSE',
        category: 'Food',
        accountId: accountAId,
        description: 'Monthly grocery bill',
      });
    assert(addExpense.status === 201 && addExpense.body.data.amount === 20000, 'POST /api/v1/transactions creates ₹20,000 expense & updates balance');
    txAExpenseId = addExpense.body.data.id;

    const accAfterExpense = await request(app).get(`/api/v1/accounts/${accountAId}`).set('Authorization', `Bearer ${tokenA}`);
    const balanceAfterExp = parseFloat(accAfterExpense.body.data.balance);

    const delTx = await request(app).delete(`/api/v1/transactions/${txAExpenseId}`).set('Authorization', `Bearer ${tokenA}`);
    assert(delTx.status === 200, 'DELETE /api/v1/transactions/:id deletes transaction');

    const accAfterDel = await request(app).get(`/api/v1/accounts/${accountAId}`).set('Authorization', `Bearer ${tokenA}`);
    const balanceAfterDel = parseFloat(accAfterDel.body.data.balance);
    assert(Math.abs(balanceAfterDel - (balanceAfterExp + 20000)) < 0.01, 'Balance automatically reversed by +₹20,000 upon transaction deletion');

    // 7. Budgets
    console.log('\n👉 [7/15] Testing Category Budgets...');
    const now = new Date();
    const addBudget = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        categoryName: 'Food & Dining',
        monthlyLimit: 15000,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
    assert(addBudget.status === 201 && addBudget.body.data.monthlyLimit == 15000, 'POST /api/v1/budgets creates category budget');
    budgetAId = addBudget.body.data.id;

    const getBudgets = await request(app).get(`/api/v1/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`).set('Authorization', `Bearer ${tokenA}`);
    assert(getBudgets.status === 200 && getBudgets.body.data.budgets.length > 0, 'GET /api/v1/budgets calculates spending and remaining limit');

    // 8. Goals
    console.log('\n👉 [8/15] Testing Financial Goals & Contributions...');
    const addGoal = await request(app)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Emergency Fund',
        goalType: 'EMERGENCY_FUND',
        targetAmount: 180000,
        currentAmount: 30000,
        monthlyContribution: 10000,
      });
    assert(addGoal.status === 201, 'POST /api/v1/goals creates savings goal');
    goalAId = addGoal.body.data.id;

    const contribGoal = await request(app)
      .patch(`/api/v1/goals/${goalAId}/contribute`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 20000 });
    assert(contribGoal.status === 200 && contribGoal.body.data.currentAmount == 50000, 'PATCH /api/v1/goals/:id/contribute increments goal amount');

    // 9. Investments, Portfolio & Metals
    console.log('\n👉 [9/15] Testing Investments, Stocks & Precious Metals...');
    const metals = await request(app).get('/api/v1/market/metals').set('Authorization', `Bearer ${tokenA}`);
    assert(metals.status === 200 && metals.body.data.gold.karat24.perGram > 0, 'GET /api/v1/market/metals returns 24K/22K Gold and Silver rates in INR');

    const buyInv = await request(app)
      .post('/api/v1/investments/buy')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        symbol: 'RELIANCE',
        name: 'Reliance Industries',
        assetType: 'STOCK',
        quantity: 10,
        buyPrice: 2400,
      });
    assert(buyInv.status === 201, 'POST /api/v1/investments/buy records asset holding');
    invAId = buyInv.body.data.id;

    const portf = await request(app).get('/api/v1/investments/portfolio').set('Authorization', `Bearer ${tokenA}`);
    assert(portf.status === 200 && portf.body.data.totalInvested >= 24000, 'GET /api/v1/investments/portfolio aggregates holdings');

    // 10. Loans & EMI
    console.log('\n👉 [10/15] Testing Loans & Prepayment Calculations...');
    const emiCalc = await request(app)
      .post('/api/v1/loans/calculate-emi')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ principal: 500000, interestRate: 8.5, tenureMonths: 60 });
    assert(emiCalc.status === 200 && emiCalc.body.data.emi > 9000, 'POST /api/v1/loans/calculate-emi calculates EMI using standard formula');

    const addLoan = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ loanType: 'HOME', lenderName: 'SBI', principalAmount: 500000, interestRate: 8.5, tenureMonths: 60 });
    assert(addLoan.status === 201, 'POST /api/v1/loans creates loan obligation');
    loanAId = addLoan.body.data.id;

    const prepay = await request(app)
      .post('/api/v1/loans/prepayment-simulate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ loanId: loanAId, prepaymentAmount: 50000 });
    assert(prepay.status === 200 && prepay.body.data.monthsSaved > 0, 'POST /api/v1/loans/prepayment-simulate simulates tenure & interest reduction');

    // 11. Insurance & Subscriptions
    console.log('\n👉 [11/15] Testing Insurance Policies & Subscriptions...');
    const addPolicy = await request(app)
      .post('/api/v1/insurance')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        policyName: 'HDFC Click 2 Protect Life',
        insurer: 'HDFC Life',
        policyType: 'LIFE',
        coverageAmount: 10000000,
        premium: 16000,
        premiumCycle: 'ANNUAL',
        renewalDate: '2027-03-31',
      });
    assert(addPolicy.status === 201 && addPolicy.body.data.coverageAmount == 10000000, 'POST /api/v1/insurance creates insurance policy');
    policyAId = addPolicy.body.data.id;

    const getPolicies = await request(app).get('/api/v1/insurance').set('Authorization', `Bearer ${tokenA}`);
    assert(getPolicies.status === 200 && getPolicies.body.data.summary.totalCoverage >= 10000000, 'GET /api/v1/insurance aggregates total coverage');

    const addSub = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        serviceName: 'Netflix Premium',
        category: 'Entertainment',
        cost: 649,
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-09-01',
      });
    assert(addSub.status === 201, 'POST /api/v1/subscriptions creates subscription');
    subAId = addSub.body.data.id;

    const getSubs = await request(app).get('/api/v1/subscriptions').set('Authorization', `Bearer ${tokenA}`);
    assert(getSubs.status === 200 && getSubs.body.data.summary.monthlyTotal >= 649, 'GET /api/v1/subscriptions calculates monthly recurring spend');

    // 12. AI Advisor, Investment Analysis & Insurance Review
    console.log('\n👉 [12/15] Testing AI Advisor & Intelligence Engines...');
    const aiRes = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'What is my current net worth?' });
    assert(aiRes.status === 200 && aiRes.body.data.response.length > 10, 'POST /api/v1/ai/chat delivers contextual financial advice');

    const aiInvest = await request(app).get('/api/v1/ai/investment-analysis').set('Authorization', `Bearer ${tokenA}`);
    assert(aiInvest.status === 200 && aiInvest.body.data.disclaimer.includes('AI-generated educational guidance'), 'GET /api/v1/ai/investment-analysis analyzes asset allocation & diversification');

    const aiIns = await request(app).get('/api/v1/ai/insurance-review').set('Authorization', `Bearer ${tokenA}`);
    assert(aiIns.status === 200 && Array.isArray(aiIns.body.data.recommendations), 'GET /api/v1/ai/insurance-review evaluates coverage gaps');

    // 13. Voice Parser
    console.log('\n👉 [13/15] Testing Natural Language Voice Entry Parser...');
    const voiceRes = await request(app)
      .post('/api/v1/transactions/voice')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ text: 'I spent 500 rupees on food' });
    assert(voiceRes.status === 200 && voiceRes.body.data.parsed.amount === 500 && voiceRes.body.data.parsed.type === 'EXPENSE', 'POST /api/v1/transactions/voice accurately parses "I spent 500 rupees on food" into structured transaction');

    // 14. Data Exports with Token Auth
    console.log('\n👉 [14/15] Testing Authenticated CSV Exports (Header & Query)...');
    const expTxHeader = await request(app).get('/api/v1/export/transactions.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expTxHeader.status === 200 && expTxHeader.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with Bearer header exports CSV');

    const expTxQuery = await request(app).get(`/api/v1/export/transactions.csv?token=${encodeURIComponent(tokenA)}`);
    assert(expTxQuery.status === 200 && expTxQuery.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with query token exports CSV');

    const expIns = await request(app).get('/api/v1/export/insurance.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expIns.status === 200 && expIns.text.includes('Policy Name'), 'GET /api/v1/export/insurance.csv exports insurance CSV');

    const expSubs = await request(app).get('/api/v1/export/subscriptions.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expSubs.status === 200 && expSubs.text.includes('Service Name'), 'GET /api/v1/export/subscriptions.csv exports subscriptions CSV');

    const expSum = await request(app).get('/api/v1/export/summary.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expSum.status === 200 && expSum.text.includes('Summary Report'), 'GET /api/v1/export/summary.csv exports financial summary');

    // 15. Multi-User Tenant Isolation
    console.log('\n👉 [15/15] Testing Multi-User Tenant Isolation (User A vs User B)...');
    const bAccs = await request(app).get('/api/v1/accounts').set('Authorization', `Bearer ${tokenB}`);
    const bAccIds = bAccs.body.data.accounts.map(a => a.id);
    assert(!bAccIds.includes(accountAId), 'User B cannot see User A accounts');

    const bAccessAAcc = await request(app).get(`/api/v1/accounts/${accountAId}`).set('Authorization', `Bearer ${tokenB}`);
    assert(bAccessAAcc.status === 404, 'User B cannot access User A account by ID (404 Not Found)');

    const bAccessAPolicy = await request(app).get(`/api/v1/insurance/${policyAId}`).set('Authorization', `Bearer ${tokenB}`);
    assert(bAccessAPolicy.status === 404, 'User B cannot access User A insurance policy (404 Not Found)');

    const bAccessAGoal = await request(app).delete(`/api/v1/goals/${goalAId}`).set('Authorization', `Bearer ${tokenB}`);
    assert(bAccessAGoal.status === 404, 'User B cannot delete User A goal (404 Not Found)');

  } catch (err) {
    console.error('\n❌ UNEXPECTED ERROR DURING SUITE:', err);
    failedCount++;
  } finally {
    if (userA?.id) await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    if (userB?.id) await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    await prisma.$disconnect();

    console.log('\n======================================================');
    console.log(`  FINAL RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log('======================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
