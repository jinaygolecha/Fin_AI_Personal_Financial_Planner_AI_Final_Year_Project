const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const dashboard = require('../controllers/dashboardController');
const accounts = require('../controllers/accountController');
const transactions = require('../controllers/transactionController');
const budgets = require('../controllers/budgetController');
const goals = require('../controllers/goalController');
const investments = require('../controllers/investmentController');
const loans = require('../controllers/loanController');
const analytics = require('../controllers/analyticsController');
const ai = require('../controllers/aiController');
const onboarding = require('../controllers/onboardingController');
const exports_ = require('../controllers/exportController');

// Apply auth to all routes below
router.use(authenticate);

// Dashboard
router.get('/dashboard', dashboard.getDashboard);

// Onboarding
router.post('/onboarding', onboarding.submitOnboarding);
router.get('/onboarding/status', onboarding.getOnboardingStatus);

// Accounts
router.get('/accounts', accounts.getAccounts);
router.post('/accounts', accounts.createAccount);
router.get('/accounts/:accountId', accounts.getAccount);
router.delete('/accounts/:accountId', accounts.deleteAccount);
router.post('/accounts/:accountId/deposit', accounts.depositMoney);
// Backward compat: add-money without account ID (auto-creates/uses primary)
router.post('/accounts/deposit', async (req, res, next) => {
  req.params.accountId = '_primary';
  // Fallback to find primary account
  const prisma = require('../config/database');
  const account = await prisma.financialAccount.findFirst({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!account) {
    const newAcc = await prisma.financialAccount.create({
      data: { userId: req.user.id, name: 'Primary Account', accountType: 'BANK', balance: 0, currency: 'INR' },
    });
    req.params.accountId = newAcc.id;
  } else {
    req.params.accountId = account.id;
  }
  accounts.depositMoney(req, res, next);
});

// Transactions
router.get('/transactions', transactions.getTransactions);
router.post('/transactions', transactions.createTransaction);
router.get('/transactions/:id', transactions.getTransaction);
router.patch('/transactions/:id', transactions.updateTransaction);
router.delete('/transactions/:id', transactions.deleteTransaction);
router.post('/transactions/voice', transactions.parseVoiceEntry);

// Budgets
router.get('/budgets', budgets.getBudgets);
router.post('/budgets', budgets.createBudget);
router.delete('/budgets/:id', budgets.deleteBudget);

// Goals
router.get('/goals', goals.getGoals);
router.post('/goals', goals.createGoal);
router.patch('/goals/:id/contribute', goals.contributeToGoal);
router.delete('/goals/:id', goals.deleteGoal);

// Investments & Market
router.get('/investments/portfolio', investments.getPortfolio);
router.post('/investments/buy', investments.buyInvestment);
router.get('/market/quote', investments.getStockQuote);
router.get('/market/popular', investments.getPopularStocks);
router.get('/market/watchlist', investments.getWatchlist);
router.post('/market/watchlist', investments.addToWatchlist);
router.delete('/market/watchlist/:symbol', investments.removeFromWatchlist);

// Loans
router.get('/loans', loans.getLoans);
router.post('/loans', loans.createLoan);
router.post('/loans/calculate-emi', loans.calculateEMIHandler);
router.post('/loans/prepayment-simulate', loans.simulatePrepaymentHandler);

// Analytics
router.get('/analytics', analytics.getAnalytics);

// Calendar
router.get('/calendar/events', analytics.getCalendarEvents);
router.post('/calendar/events', analytics.createCalendarEvent);

// Notifications
router.get('/notifications', analytics.getNotifications);
router.patch('/notifications/:id/read', analytics.markNotificationRead);

// AI
router.post('/ai/chat', ai.chat);
router.get('/ai/history', ai.getChatHistory);
router.delete('/ai/history', ai.clearChatHistory);
router.get('/ai/snapshot', ai.getFinancialSnapshot);

// Export
router.get('/export/transactions.csv', exports_.exportTransactionsCSV);
router.get('/export/accounts.csv', exports_.exportAccountsCSV);
router.get('/export/summary.csv', exports_.exportSummaryCSV);

module.exports = router;
