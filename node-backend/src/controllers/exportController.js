const prisma = require('../config/database');

/**
 * GET /api/v1/export/transactions.csv
 * Export user's transactions as CSV (only their own data)
 */
const exportTransactionsCSV = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: { select: { name: true } }, account: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    const rows = [
      ['Date', 'Type', 'Amount (INR)', 'Category', 'Account', 'Description', 'Merchant', 'Payment Method'],
      ...transactions.map(t => [
        new Date(t.date).toLocaleDateString('en-IN'),
        t.transactionType,
        parseFloat(t.amount).toFixed(2),
        t.category?.name || 'Uncategorized',
        t.account?.name || 'Unknown',
        t.description || '',
        t.merchant || '',
        t.paymentMethod || '',
      ]),
    ];

    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jinay_finance_transactions_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send('\uFEFF' + csvContent); // BOM for proper Excel display
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/export/accounts.csv
 */
const exportAccountsCSV = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const accounts = await prisma.financialAccount.findMany({
      where: { userId, isActive: true },
    });

    const rows = [
      ['Account Name', 'Type', 'Institution', 'Balance (INR)', 'Currency'],
      ...accounts.map(a => [a.name, a.accountType, a.institution || '', parseFloat(a.balance).toFixed(2), a.currency]),
    ];

    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jinay_finance_accounts_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send('\uFEFF' + csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/export/summary.csv
 */
const exportSummaryCSV = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [accounts, goals, loans, portfolio] = await Promise.all([
      prisma.financialAccount.aggregate({ where: { userId, isActive: true }, _sum: { balance: true } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.loan.aggregate({ where: { userId, status: 'ACTIVE' }, _sum: { outstandingBalance: true, emiAmount: true } }),
      prisma.portfolio.findUnique({ where: { userId }, select: { totalInvested: true, currentValue: true } }),
    ]);

    const totalBalance = parseFloat(accounts._sum.balance || 0);
    const totalDebt = parseFloat(loans._sum.outstandingBalance || 0);
    const investmentValue = parseFloat(portfolio?.currentValue || 0);
    const netWorth = totalBalance + investmentValue - totalDebt;

    const rows = [
      ['Summary Report - Jinay Finance AI'],
      ['Generated', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
      [],
      ['Metric', 'Value (INR)'],
      ['Total Bank Balance', totalBalance.toFixed(2)],
      ['Investment Portfolio Value', investmentValue.toFixed(2)],
      ['Total Outstanding Loans', totalDebt.toFixed(2)],
      ['Monthly EMI', parseFloat(loans._sum.emiAmount || 0).toFixed(2)],
      ['Net Worth', netWorth.toFixed(2)],
      [],
      ['Goals', 'Target', 'Current', 'Progress'],
      ...goals.map(g => [g.name, parseFloat(g.targetAmount).toFixed(2), parseFloat(g.currentAmount).toFixed(2), `${Math.round((parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100)}%`]),
    ];

    const csvContent = rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jinay_finance_summary_${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send('\uFEFF' + csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = { exportTransactionsCSV, exportAccountsCSV, exportSummaryCSV };
