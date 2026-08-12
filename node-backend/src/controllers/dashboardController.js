const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');
const { calculateHealthScore } = require('../utils/financialMath');

/**
 * GET /api/v1/dashboard
 * Returns all financial metrics for the authenticated user
 */
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Run all queries in parallel for performance
    const [
      accounts,
      monthlyIncome,
      monthlyExpenses,
      allTimeBalance,
      recentTransactions,
      goals,
      activeLoan,
      portfolio,
      budgets,
      financialPlan,
      notifications,
    ] = await Promise.all([
      prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: { balance: true },
      }),

      prisma.transaction.aggregate({
        where: { userId, transactionType: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),

      prisma.transaction.aggregate({
        where: { userId, transactionType: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),

      prisma.transaction.aggregate({
        where: { userId, transactionType: 'INCOME' },
        _sum: { amount: true },
      }),

      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 5,
        include: { category: { select: { name: true } } },
      }),

      prisma.goal.findMany({
        where: { userId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),

      prisma.loan.aggregate({
        where: { userId, status: 'ACTIVE' },
        _sum: { outstandingBalance: true, emiAmount: true },
      }),

      prisma.portfolio.findUnique({
        where: { userId },
        select: { totalInvested: true, currentValue: true },
      }),

      prisma.budget.findMany({
        where: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
      }),

      prisma.financialPlan.findUnique({
        where: { userId },
        select: { financialHealthScore: true, planSummary: true },
      }),

      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    // Compute totals
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const incomeAmt = parseFloat(monthlyIncome._sum.amount || 0);
    const expenseAmt = parseFloat(monthlyExpenses._sum.amount || 0);
    const monthlySavings = incomeAmt - expenseAmt;
    const savingsRate = incomeAmt > 0 ? Math.round((monthlySavings / incomeAmt) * 100) : 0;
    const investmentValue = parseFloat(portfolio?.currentValue || 0);
    const loanOutstanding = parseFloat(activeLoan._sum.outstandingBalance || 0);
    const totalMonthlyEMI = parseFloat(activeLoan._sum.emiAmount || 0);
    const netWorth = totalBalance + investmentValue - loanOutstanding;

    // Budget usage
    const totalBudgetLimit = budgets.reduce((s, b) => s + parseFloat(b.monthlyLimit || 0), 0);

    // Health score from plan or calculate live
    const healthScore = financialPlan?.financialHealthScore ?? calculateHealthScore({
      monthlyIncome: incomeAmt,
      monthlyExpenses: expenseAmt,
      totalSavings: totalBalance,
      totalDebt: loanOutstanding,
      totalInvestments: investmentValue,
    });

    return res.status(200).json({
      success: true,
      data: {
        // Summary metrics
        totalBalance,
        monthlyIncome: incomeAmt,
        monthlyExpenses: expenseAmt,
        monthlySavings,
        savingsRate,
        netWorth,
        investmentValue,
        loanOutstanding,
        totalMonthlyEMI,
        budgetLimit: totalBudgetLimit,
        financialHealthScore: healthScore,
        unreadNotifications: notifications,

        // Formatted
        formatted: {
          totalBalance: formatINR(totalBalance),
          monthlyIncome: formatINR(incomeAmt),
          monthlyExpenses: formatINR(expenseAmt),
          monthlySavings: formatINR(monthlySavings),
          netWorth: formatINR(netWorth),
          investmentValue: formatINR(investmentValue),
          loanOutstanding: formatINR(loanOutstanding),
          totalMonthlyEMI: formatINR(totalMonthlyEMI),
        },

        // Recent data
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          description: t.description || t.merchant || 'Transaction',
          amount: parseFloat(t.amount),
          formattedAmount: formatINR(t.amount),
          type: t.transactionType,
          category: t.category?.name || 'Uncategorized',
          date: t.date,
        })),

        goals: goals.map((g) => ({
          id: g.id,
          name: g.name,
          targetAmount: parseFloat(g.targetAmount),
          currentAmount: parseFloat(g.currentAmount),
          formattedTarget: formatINR(g.targetAmount),
          formattedCurrent: formatINR(g.currentAmount),
          progress: g.targetAmount > 0
            ? Math.round((parseFloat(g.currentAmount) / parseFloat(g.targetAmount)) * 100)
            : 0,
        })),

        planSummary: financialPlan?.planSummary || '',
        currency: 'INR',
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
