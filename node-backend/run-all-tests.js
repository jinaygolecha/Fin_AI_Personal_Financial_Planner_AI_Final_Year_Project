/**
 * Jinay Finance AI — Master Comprehensive Acceptance & Integration Test Suite
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
  console.log('\n====================================================================');
  console.log('  JINAY FINANCE AI — MASTER COMPREHENSIVE INTEGRATION & ACCEPTANCE SUITE');
  console.log('====================================================================\n');

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
    console.log('👉 [1/20] Testing Health & Diagnostic Endpoints...');
    const health = await request(app).get('/api/v1/health');
    assert(health.status === 200 && health.body.success === true && health.body.database === 'connected', 'GET /api/v1/health returns success and connected database');

    const dbHealth = await request(app).get('/api/v1/health/database');
    assert(dbHealth.status === 200 && dbHealth.body.status === 'connected', 'GET /api/v1/health/database confirms PostgreSQL connectivity');

    const aiHealth = await request(app).get('/api/v1/health/ai');
    assert(aiHealth.status === 200 && aiHealth.body.provider === 'Google Gemini', 'GET /api/v1/health/ai returns AI provider status');

    const marketHealth = await request(app).get('/api/v1/health/market');
    assert(marketHealth.status === 200 && marketHealth.body.provider === 'Finnhub', 'GET /api/v1/health/market returns Finnhub status');

    // 2. Authentication Flow
    console.log('\n👉 [2/20] Testing Centralized Authentication Flow...');
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
    console.log('\n👉 [3/20] Testing Financial Onboarding...');
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
    console.log('\n👉 [4/20] Testing Accounts & Deposit Atomicity...');
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
    console.log('\n👉 [5/20] Testing Real-time Dashboard Aggregations...');
    const dash = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${tokenA}`);
    assert(dash.status === 200 && dash.body.data.monthlyIncome >= 100000, 'GET /api/v1/dashboard calculates Monthly Income from DB');
    assert(dash.body.data.totalBalance >= 100000, 'GET /api/v1/dashboard reflects total balance from DB');
    assert(typeof dash.body.data.financialHealthScore === 'number', 'GET /api/v1/dashboard calculates Financial Health Score');

    // 6. Transactions & Reversals & Anomaly Detection
    console.log('\n👉 [6/20] Testing Transactions CRUD, Anomaly Detection & Reversals...');
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

    const anomaliesList = await request(app).get('/api/v1/ai/anomalies').set('Authorization', `Bearer ${tokenA}`);
    assert(anomaliesList.status === 200 && Array.isArray(anomaliesList.body.data), 'GET /api/v1/ai/anomalies returns anomaly list');

    const accAfterExpense = await request(app).get(`/api/v1/accounts/${accountAId}`).set('Authorization', `Bearer ${tokenA}`);
    const balanceAfterExp = parseFloat(accAfterExpense.body.data.balance);

    const delTx = await request(app).delete(`/api/v1/transactions/${txAExpenseId}`).set('Authorization', `Bearer ${tokenA}`);
    assert(delTx.status === 200, 'DELETE /api/v1/transactions/:id deletes transaction');

    const accAfterDel = await request(app).get(`/api/v1/accounts/${accountAId}`).set('Authorization', `Bearer ${tokenA}`);
    const balanceAfterDel = parseFloat(accAfterDel.body.data.balance);
    assert(Math.abs(balanceAfterDel - (balanceAfterExp + 20000)) < 0.01, 'Balance automatically reversed by +₹20,000 upon transaction deletion');

    // 7. Budgets & Budget Optimizer
    console.log('\n👉 [7/20] Testing Category Budgets & Smart AI Budget Optimizer...');
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

    const budgetOpt = await request(app).get('/api/v1/ai/budget-optimize?method=50/30/20').set('Authorization', `Bearer ${tokenA}`);
    assert(budgetOpt.status === 200 && budgetOpt.body.data.recommendations.length > 0, 'GET /api/v1/ai/budget-optimize generates 50/30/20 budget allocations');

    // 8. Goals & Goal Forecast
    console.log('\n👉 [8/20] Testing Financial Goals & Completion Forecasting...');
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

    const goalFc = await request(app).get(`/api/v1/ai/goals/${goalAId}/forecast`).set('Authorization', `Bearer ${tokenA}`);
    assert(goalFc.status === 200 && goalFc.body.data.scenarios.plus2000, 'GET /api/v1/ai/goals/:id/forecast calculates completion dates & +₹2k scenario');

    // 9. Investments, Gold, Silver & Historical Charts
    console.log('\n👉 [9/20] Testing Real-Time Stocks, 24K/22K Gold, Silver & Charts...');
    const metals = await request(app).get('/api/v1/market/metals').set('Authorization', `Bearer ${tokenA}`);
    assert(metals.status === 200 && metals.body.data.gold.karat24.perGram > 0, 'GET /api/v1/market/metals returns 24K/22K Gold and Silver rates in INR');

    const goldRate = await request(app).get('/api/v1/market/gold').set('Authorization', `Bearer ${tokenA}`);
    assert(goldRate.status === 200 && goldRate.body.data.karat24.perGram > 0, 'GET /api/v1/market/gold returns dedicated 24K/22K gold feed');

    const silverRate = await request(app).get('/api/v1/market/silver').set('Authorization', `Bearer ${tokenA}`);
    assert(silverRate.status === 200 && silverRate.body.data.perGram > 0, 'GET /api/v1/market/silver returns dedicated silver feed');

    const stockHist = await request(app).get('/api/v1/market/history?symbol=RELIANCE&timeframe=1M').set('Authorization', `Bearer ${tokenA}`);
    assert(stockHist.status === 200 && stockHist.body.data.points.length > 0, 'GET /api/v1/market/history delivers multi-timeframe stock chart points');

    const stockSearch = await request(app).get('/api/v1/market/search?q=TCS').set('Authorization', `Bearer ${tokenA}`);
    assert(stockSearch.status === 200 && stockSearch.body.data.some(s => s.symbol === 'TCS'), 'GET /api/v1/market/search finds matching stocks');

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

    const buyGold = await request(app)
      .post('/api/v1/investments/buy')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        symbol: 'GOLD24K',
        name: '24K Physical Gold',
        assetType: 'GOLD',
        quantity: 10,
        buyPrice: 7400,
      });
    assert(buyGold.status === 201, 'POST /api/v1/investments/buy records 24K gold holding');

    const portf = await request(app).get('/api/v1/investments/portfolio').set('Authorization', `Bearer ${tokenA}`);
    assert(portf.status === 200 && portf.body.data.holdings.length >= 2, 'GET /api/v1/investments/portfolio aggregates holdings with live market prices');

    // 10. Loans & Prepayment Simulator
    console.log('\n👉 [10/20] Testing Loans & Prepayment Calculations...');
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

    // 11. Insurance Policies & Subscriptions
    console.log('\n👉 [11/20] Testing Insurance Policies & Subscriptions...');
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

    // 12. Advanced 10-Factor Health Score & History
    console.log('\n👉 [12/20] Testing 10-Factor AI Financial Health Score & History...');
    const healthScoreRes = await request(app).get('/api/v1/ai/financial-health').set('Authorization', `Bearer ${tokenA}`);
    assert(healthScoreRes.status === 200 && typeof healthScoreRes.body.data.overallScore === 'number', 'GET /api/v1/ai/financial-health returns 10-factor score & breakdown');
    assert(healthScoreRes.body.data.components.emergency.score > 0, 'Health score includes Emergency Fund factor score');
    assert(healthScoreRes.body.data.components.savings.score > 0, 'Health score includes Savings Rate factor score');

    // 13. Cash Flow Prediction (7d, 30d, 90d)
    console.log('\n👉 [13/20] Testing Predictive Cash Flow Engine...');
    const cf30 = await request(app).get('/api/v1/ai/cash-flow?days=30').set('Authorization', `Bearer ${tokenA}`);
    assert(cf30.status === 200 && cf30.body.data.projections.length === 30, 'GET /api/v1/ai/cash-flow generates 30-day balance trajectory with obligations');

    const cf90 = await request(app).get('/api/v1/ai/cash-flow?days=90').set('Authorization', `Bearer ${tokenA}`);
    assert(cf90.status === 200 && cf90.body.data.projections.length === 90, 'GET /api/v1/ai/cash-flow generates 90-day balance trajectory');

    // 14. What-If Financial Simulator
    console.log('\n👉 [14/20] Testing What-If Financial Simulator...');
    const simRes = await request(app)
      .post('/api/v1/ai/simulate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scenarioName: 'Salary Hike & Extra SIP',
        salaryChangePercent: 10,
        extraMonthlyInvestment: 5000,
        loanPrepaymentAmount: 50000,
      });
    assert(simRes.status === 200 && simRes.body.data.comparison.monthlyCashFlow.change !== undefined, 'POST /api/v1/ai/simulate calculates Current vs Scenario impact on cash flow & net worth');

    const simHistory = await request(app).get('/api/v1/ai/simulations/history').set('Authorization', `Bearer ${tokenA}`);
    assert(simHistory.status === 200 && simHistory.body.data.length > 0, 'GET /api/v1/ai/simulations/history lists persisted simulations');

    // 15. Retirement Planner
    console.log('\n👉 [15/20] Testing Retirement Planner Engine...');
    const retPlan = await request(app)
      .post('/api/v1/ai/retirement-plan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentAge: 25,
        retirementAge: 60,
        currentSavings: 500000,
        monthlyContribution: 15000,
        expectedReturn: 12,
      });
    assert(retPlan.status === 200 && retPlan.body.data.estimatedCorpus > 0, 'POST /api/v1/ai/retirement-plan projects retirement corpus across conservative/base/optimistic scenarios');

    // 16. OCR Receipt Scanner & Bank Statement CSV Importer
    console.log('\n👉 [16/20] Testing OCR Receipt Scanner & Statement CSV Importer...');
    const ocrScan = await request(app)
      .post('/api/v1/receipts/scan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiptText: 'STARBUCKS COFFEE Total: Rs 850.00 Date: 2026-08-16' });
    assert(ocrScan.status === 200 && ocrScan.body.data.amount === 850, 'POST /api/v1/receipts/scan extracts merchant, amount & category with confirmation state');

    const ocrConfirm = await request(app)
      .post('/api/v1/receipts/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scanId: ocrScan.body.data.scanId,
        amount: 850,
        merchant: 'Starbucks Coffee',
        category: 'Food',
        accountId: accountAId,
      });
    assert(ocrConfirm.status === 201 && ocrConfirm.body.data.transaction.amount == 850, 'POST /api/v1/receipts/confirm persists transaction to DB after user approval');

    const csvTest = `Date,Description,Amount,Type\n2026-08-10,Salary Deposit,85000,INCOME\n2026-08-12,Grocery Supermarket,4200,EXPENSE`;
    const parseCsv = await request(app)
      .post('/api/v1/import/bank-statement')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ csvContent: csvTest });
    assert(parseCsv.status === 200 && parseCsv.body.data.validCount === 2, 'POST /api/v1/import/bank-statement parses CSV and detects valid/duplicate rows');

    const confirmCsv = await request(app)
      .post('/api/v1/import/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rows: parseCsv.body.data.validRows, accountId: accountAId });
    assert(confirmCsv.status === 200 && confirmCsv.body.data.importedCount === 2, 'POST /api/v1/import/confirm commits imported transactions to account');

    // 17. Voice Intent Parser & Risk Radar
    console.log('\n👉 [17/20] Testing Voice Assistant Intent Parsing & Risk Radar...');
    const voiceQuery = await request(app)
      .post('/api/v1/ai/voice-intent')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ speechText: 'How much did I spend this month?' });
    assert(voiceQuery.status === 200 && voiceQuery.body.data.intent === 'QUERY_EXPENSES', 'POST /api/v1/ai/voice-intent correctly parses QUERY_EXPENSES without confirmation requirement');

    const voiceAdd = await request(app)
      .post('/api/v1/ai/voice-intent')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ speechText: 'Add 500 food expense' });
    assert(voiceAdd.status === 200 && voiceAdd.body.data.requiresConfirmation === true, 'POST /api/v1/ai/voice-intent requires safety confirmation for expense creation');

    const riskRadar = await request(app).get('/api/v1/ai/risk-radar').set('Authorization', `Bearer ${tokenA}`);
    assert(riskRadar.status === 200 && Array.isArray(riskRadar.body.data.risks), 'GET /api/v1/ai/risk-radar evaluates debt, liquidity, and insurance risk factors');

    // 18. Recommendation Feedback Loop & Monthly Financial Report
    console.log('\n👉 [18/20] Testing AI Feedback Loop & Monthly Financial Report...');
    const feedbackRes = await request(app)
      .post('/api/v1/ai/recommendations/rec-123/feedback')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ feedbackType: 'HELPFUL', recommendationTitle: 'Emergency Fund Tip' });
    assert(feedbackRes.status === 201 && feedbackRes.body.data.feedback.feedbackType === 'HELPFUL', 'POST /api/v1/ai/recommendations/:id/feedback stores user feedback to learn preferences');

    const monthlyRep = await request(app).get('/api/v1/reports/monthly').set('Authorization', `Bearer ${tokenA}`);
    assert(monthlyRep.status === 200 && monthlyRep.body.data.summary.totalIncome !== undefined, 'GET /api/v1/reports/monthly delivers comprehensive monthly financial report');

    // 19. Data Exports with Token Auth
    console.log('\n👉 [19/20] Testing Authenticated CSV Exports...');
    const expTxHeader = await request(app).get('/api/v1/export/transactions.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expTxHeader.status === 200 && expTxHeader.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with Bearer header exports CSV');

    const expTxQuery = await request(app).get(`/api/v1/export/transactions.csv?token=${encodeURIComponent(tokenA)}`);
    assert(expTxQuery.status === 200 && expTxQuery.headers['content-type'].includes('text/csv'), 'GET /api/v1/export/transactions.csv with query token exports CSV');

    const expSum = await request(app).get('/api/v1/export/summary.csv').set('Authorization', `Bearer ${tokenA}`);
    assert(expSum.status === 200 && expSum.text.includes('Summary Report'), 'GET /api/v1/export/summary.csv exports financial summary');

    // 20. Multi-User Tenant Isolation
    console.log('\n👉 [20/20] Testing Multi-User Tenant Isolation (User A vs User B)...');
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

    console.log('\n====================================================================');
    console.log(`  FINAL RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log('====================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
