const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

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
 * GET /api/v1/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
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

module.exports = { getAnalytics, getCalendarEvents, createCalendarEvent, getNotifications, markNotificationRead };
