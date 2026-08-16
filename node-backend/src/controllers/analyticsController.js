const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');
const financialTwin = require('../services/financialTwinService');

/**
 * Analytics, Health Scoring & Reports Controller
 * Owner: Jinay Golecha (jinay_golecha)
 */

/**
 * GET /api/v1/analytics
 */
const getAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const period = req.query.period || 'month'; // month | year | week

    let startDate;
    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [income, expenses, categoryBreakdown, monthlyTrend] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, transactionType: 'INCOME', date: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { userId, transactionType: 'EXPENSE', date: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, transactionType: 'EXPENSE', date: { gte: startDate } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      prisma.transaction.groupBy({
        by: ['date'],
        where: { userId, date: { gte: startDate } },
        _sum: { amount: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Resolve category names
    const categoryIds = categoryBreakdown.map(c => c.categoryId).filter(Boolean);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    const totalIncome = parseFloat(income._sum.amount || 0);
    const totalExpenses = parseFloat(expenses._sum.amount || 0);
    const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        period,
        summary: {
          totalIncome,
          formattedIncome: formatINR(totalIncome),
          totalExpenses,
          formattedExpenses: formatINR(totalExpenses),
          netSavings: totalIncome - totalExpenses,
          formattedNetSavings: formatINR(totalIncome - totalExpenses),
          savingsRate,
          incomeTransactions: income._count,
          expenseTransactions: expenses._count,
        },
        categoryBreakdown: categoryBreakdown.map(c => ({
          category: catMap[c.categoryId] || 'Uncategorized',
          amount: parseFloat(c._sum.amount || 0),
          formattedAmount: formatINR(c._sum.amount || 0),
          percentage: totalExpenses > 0 ? Math.round((parseFloat(c._sum.amount || 0) / totalExpenses) * 100) : 0,
        })),
        monthlyTrend: monthlyTrend.map(t => ({
          date: t.date,
          amount: parseFloat(t._sum.amount || 0),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/financial-health
 * Feature 1: Advanced AI Financial Health Score (0-100)
 */
const getFinancialHealth = async (req, res, next) => {
  try {
    const health = await financialTwin.calculateDetailedHealthScore(req.user.id);
    return res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/cash-flow
 * Feature 2: Cash Flow Prediction (7, 30, 90 Days)
 */
const getCashFlowPrediction = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const prediction = await financialTwin.predictCashFlow(req.user.id, days);
    return res.status(200).json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/anomalies
 * Feature 3: Expense Anomalies list
 */
const getExpenseAnomalies = async (req, res, next) => {
  try {
    const anomalies = await prisma.expenseAnomaly.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({
      success: true,
      data: anomalies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/ai/anomalies/:id/feedback
 * Feature 3: Expense Anomaly Feedback (CONFIRMED_NORMAL / SUSPICIOUS / IGNORED)
 */
const submitAnomalyFeedback = async (req, res, next) => {
  try {
    const { feedback } = req.body; // CONFIRMED_NORMAL | SUSPICIOUS | IGNORED
    const anomaly = await prisma.expenseAnomaly.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!anomaly) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Anomaly not found' } });
    }

    const updated = await prisma.expenseAnomaly.update({
      where: { id: req.params.id },
      data: { userFeedback: feedback || 'CONFIRMED_NORMAL' },
    });

    return res.status(200).json({
      success: true,
      data: {
        anomaly: updated,
        message: `Feedback recorded: ${feedback}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/budget-optimize
 * Feature 4: Smart Budget Optimizer
 */
const getBudgetOptimization = async (req, res, next) => {
  try {
    const method = req.query.method || '50/30/20';
    const optimized = await financialTwin.optimizeBudget(req.user.id, method);
    return res.status(200).json({
      success: true,
      data: optimized,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/risk-radar
 * Feature 28: Financial Risk Radar
 */
const getRiskRadar = async (req, res, next) => {
  try {
    const radar = await financialTwin.evaluateRiskRadar(req.user.id);
    return res.status(200).json({
      success: true,
      data: radar,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/reports/monthly
 * Feature 22: AI Monthly Financial Report
 */
const getMonthlyFinancialReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const [
      user,
      incomes,
      expenses,
      categoryExpenses,
      budgets,
      portfolio,
      goals,
      loans,
      insurance,
      subscriptions,
      healthScore,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } }),
      prisma.transaction.aggregate({
        where: { userId, transactionType: 'INCOME', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { userId, transactionType: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { userId, transactionType: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.portfolio.findUnique({ where: { userId }, include: { investments: true } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.loan.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.insurancePolicy.findMany({ where: { userId, isActive: true } }),
      prisma.subscription.findMany({ where: { userId, isActive: true } }),
      financialTwin.calculateDetailedHealthScore(userId),
    ]);

    const totalIncome = parseFloat(incomes._sum.amount || 0);
    const totalExpenses = parseFloat(expenses._sum.amount || 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        reportMonth: `${month}/${year}`,
        generatedAt: new Date().toISOString(),
        user: { name: `${user?.firstName} ${user?.lastName}`.trim(), email: user?.email },
        summary: {
          totalIncome,
          formattedTotalIncome: formatINR(totalIncome),
          totalExpenses,
          formattedTotalExpenses: formatINR(totalExpenses),
          netSavings,
          formattedNetSavings: formatINR(netSavings),
          savingsRate,
          healthScore: healthScore.overallScore,
        },
        healthBreakdown: healthScore.components,
        topExpenseCategories: categoryExpenses.map(c => ({
          categoryId: c.categoryId,
          amount: parseFloat(c._sum.amount || 0),
          formattedAmount: formatINR(c._sum.amount || 0),
        })),
        activeLoansCount: loans.length,
        totalDebt: loans.reduce((s, l) => s + parseFloat(l.outstandingBalance), 0),
        insurancePoliciesCount: insurance.length,
        activeSubscriptionsCount: subscriptions.length,
        activeGoalsCount: goals.length,
        aiRecommendations: healthScore.recommendations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/calendar/events
 */
const getCalendarEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [customEvents, loans, subscriptions, goals] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { userId, eventDate: { gte: startDate, lte: endDate } },
        orderBy: { eventDate: 'asc' },
      }),
      prisma.loan.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, loanType: true, emiAmount: true, startDate: true },
      }),
      prisma.subscription.findMany({
        where: { userId, isActive: true, nextBillingDate: { gte: startDate, lte: endDate } },
        select: { id: true, serviceName: true, cost: true, nextBillingDate: true },
      }),
      prisma.goal.findMany({
        where: { userId, status: 'ACTIVE', targetDate: { gte: startDate, lte: endDate } },
        select: { id: true, name: true, targetAmount: true, targetDate: true },
      }),
    ]);

    const events = [
      ...customEvents.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description || '',
        type: e.eventType || 'CUSTOM',
        date: e.eventDate,
        amount: e.amount ? parseFloat(e.amount) : null,
        formattedAmount: e.amount ? formatINR(e.amount) : null,
        color: e.color || '#4F46E5',
      })),
      ...loans.map(l => ({
        id: l.id + '-emi',
        title: `${l.loanType} Loan EMI Due`,
        description: `Monthly EMI: ${formatINR(l.emiAmount)}`,
        type: 'EMI',
        date: new Date(year, month - 1, new Date(l.startDate).getDate()),
        amount: parseFloat(l.emiAmount || 0),
        formattedAmount: formatINR(l.emiAmount || 0),
        color: '#EF4444',
      })),
      ...subscriptions.map(s => ({
        id: s.id + '-sub',
        title: `${s.serviceName} Renewal`,
        description: `Subscription: ${formatINR(s.cost)}`,
        type: 'SUBSCRIPTION',
        date: s.nextBillingDate,
        amount: parseFloat(s.cost || 0),
        formattedAmount: formatINR(s.cost || 0),
        color: '#F59E0B',
      })),
      ...goals.map(g => ({
        id: g.id + '-goal',
        title: `Goal Deadline: ${g.name}`,
        description: `Target: ${formatINR(g.targetAmount)}`,
        type: 'GOAL',
        date: g.targetDate,
        amount: parseFloat(g.targetAmount || 0),
        formattedAmount: formatINR(g.targetAmount || 0),
        color: '#10B981',
      })),
    ];

    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      success: true,
      data: { month, year, events },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/calendar/events
 */
const createCalendarEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, eventType = 'CUSTOM', eventDate, amount, color } = req.body;

    if (!title || !eventDate) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title and event date are required.' },
      });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title: title.trim(),
        description: description?.trim() || null,
        eventType,
        eventDate: new Date(eventDate),
        amount: amount ? parseFloat(amount) : null,
        color: color || '#4F46E5',
      },
    });

    return res.status(201).json({ success: true, data: { ...event, message: 'Event created!' } });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/calendar/events/:id
 */
const updateCalendarEvent = async (req, res, next) => {
  try {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!event) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } });
    }

    const { title, description, eventType, eventDate, amount, color } = req.body;
    const updated = await prisma.calendarEvent.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(eventType && { eventType }),
        ...(eventDate && { eventDate: new Date(eventDate) }),
        ...(amount !== undefined && { amount: amount ? parseFloat(amount) : null }),
        ...(color && { color }),
      },
    });

    return res.status(200).json({ success: true, data: { ...updated, message: 'Event updated.' } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/calendar/events/:id
 */
const deleteCalendarEvent = async (req, res, next) => {
  try {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!event) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } });
    }

    await prisma.calendarEvent.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, data: { message: 'Event deleted.' } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/notifications
 */
const createNotification = async (req, res, next) => {
  try {
    const { title, message, type = 'INFO' } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Title and message required.' } });
    }
    const notif = await prisma.notification.create({
      data: {
        userId: req.user.id,
        title: title.trim(),
        message: message.trim(),
        type: type,
        isRead: false,
      },
    });
    return res.status(201).json({ success: true, data: notif });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/notifications/:id/read
 */
const markNotificationRead = async (req, res, next) => {
  try {
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notif) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    return res.status(200).json({ success: true, data: { message: 'Marked as read.' } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/notifications/read-all
 */
const markAllNotificationsRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return res.status(200).json({ success: true, data: { message: 'All notifications marked as read.' } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notif = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notif) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found.' } });
    }
    await prisma.notification.delete({ where: { id: req.params.id } });
    return res.status(200).json({ success: true, data: { message: 'Notification deleted.' } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
  getFinancialHealth,
  getCashFlowPrediction,
  getExpenseAnomalies,
  submitAnomalyFeedback,
  getBudgetOptimization,
  getRiskRadar,
  getMonthlyFinancialReport,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
