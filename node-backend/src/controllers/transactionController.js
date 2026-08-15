const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

/**
 * GET /api/v1/transactions
 * List transactions for authenticated user with filters
 */
const getTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type,
      category,
      startDate,
      endDate,
      search,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { userId };
    if (type) where.transactionType = type.toUpperCase();
    if (category) where.category = { name: { contains: category, mode: 'insensitive' } };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: { select: { name: true } }, account: { select: { name: true } } },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: parseFloat(t.amount),
          formattedAmount: formatINR(t.amount),
          type: t.transactionType,
          category: t.category?.name || 'Uncategorized',
          account: t.account?.name || 'Unknown',
          description: t.description || '',
          merchant: t.merchant || '',
          date: t.date,
          currency: t.currency,
          createdAt: t.createdAt,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/transactions
 */
const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      amount,
      type = 'EXPENSE',
      category: categoryName,
      accountId,
      description,
      merchant,
      date,
      notes,
      paymentMethod,
    } = req.body;

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Amount must be a positive number.' },
      });
    }

    const transactionType = type.toUpperCase();
    const validTypes = ['INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT', 'LOAN_PAYMENT'];
    if (!validTypes.includes(transactionType)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Type must be one of: ${validTypes.join(', ')}` },
      });
    }

    // Resolve or create category
    let categoryRecord = null;
    if (categoryName) {
      categoryRecord = await prisma.category.findFirst({
        where: { userId, name: { equals: categoryName, mode: 'insensitive' } },
      });
      if (!categoryRecord) {
        categoryRecord = await prisma.category.create({
          data: {
            userId,
            name: categoryName,
            categoryType: transactionType === 'INCOME' ? 'INCOME' : 'EXPENSE',
          },
        });
      }
    }

    // Find or resolve account
    let targetAccountId = accountId;
    if (targetAccountId) {
      const account = await prisma.financialAccount.findFirst({
        where: { id: targetAccountId, userId },
      });
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found.' },
        });
      }
    } else {
      const defaultAcc = await prisma.financialAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultAcc) {
        targetAccountId = defaultAcc.id;
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          userId,
          accountId: targetAccountId || null,
          categoryId: categoryRecord?.id || null,
          amount: amountNum,
          transactionType,
          description: description?.trim() || null,
          merchant: merchant?.trim() || null,
          notes: notes?.trim() || null,
          paymentMethod: paymentMethod || null,
          date: date ? new Date(date) : new Date(),
          currency: 'INR',
        },
        include: { category: { select: { name: true } }, account: { select: { name: true } } },
      });

      // Update account balance
      if (targetAccountId) {
        const balanceDelta = transactionType === 'INCOME' ? amountNum : -amountNum;
        await tx.financialAccount.update({
          where: { id: targetAccountId },
          data: { balance: { increment: balanceDelta } },
        });
      }

      return t;
    });

    let anomalyLevel = 'NORMAL';
    if (transactionType === 'EXPENSE' && amountNum >= 50000) {
      anomalyLevel = amountNum >= 200000 ? 'HIGHLY_UNUSUAL' : 'UNUSUAL';
      await prisma.notification.create({
        data: {
          userId,
          title: anomalyLevel === 'HIGHLY_UNUSUAL' ? 'High Value Expense Alert' : 'Unusual Expense Detected',
          message: `Recorded a high-value expense of ${formatINR(amountNum)} for ${categoryRecord?.name || 'Uncategorized'}.`,
          type: 'WARNING',
        },
      }).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      data: {
        id: transaction.id,
        amount: parseFloat(transaction.amount),
        formattedAmount: formatINR(transaction.amount),
        type: transaction.transactionType,
        category: transaction.category?.name || 'Uncategorized',
        account: transaction.account?.name || 'Primary Account',
        date: transaction.date,
        anomalyStatus: anomalyLevel,
        message: 'Transaction created successfully!',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/transactions/:id
 */
const getTransaction = async (req, res, next) => {
  try {
    const t = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { category: true, account: true },
    });

    if (!t) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: { ...t, formattedAmount: formatINR(t.amount) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/transactions/:id
 */
const updateTransaction = async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found.' },
      });
    }

    const { amount, description, merchant, date, notes, type, category: categoryName } = req.body;

    let categoryId = undefined;
    if (categoryName) {
      let cat = await prisma.category.findFirst({
        where: { userId: req.user.id, name: { equals: categoryName, mode: 'insensitive' } },
      });
      if (!cat) {
        cat = await prisma.category.create({
          data: { userId: req.user.id, name: categoryName, categoryType: 'EXPENSE' },
        });
      }
      categoryId = cat.id;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const newAmount = amount !== undefined ? parseFloat(amount) : parseFloat(existing.amount);
      const newType = type ? type.toUpperCase() : existing.transactionType;

      // Adjust account balance if amount or type changed
      if (existing.accountId && (amount !== undefined || type !== undefined)) {
        const oldDelta = existing.transactionType === 'INCOME' ? parseFloat(existing.amount) : -parseFloat(existing.amount);
        const newDelta = newType === 'INCOME' ? newAmount : -newAmount;
        const diff = newDelta - oldDelta;
        if (diff !== 0) {
          await tx.financialAccount.update({
            where: { id: existing.accountId },
            data: { balance: { increment: diff } },
          });
        }
      }

      return await tx.transaction.update({
        where: { id: req.params.id },
        data: {
          ...(amount !== undefined && { amount: newAmount }),
          ...(type && { transactionType: newType }),
          ...(categoryId && { categoryId }),
          ...(description !== undefined && { description }),
          ...(merchant !== undefined && { merchant }),
          ...(date && { date: new Date(date) }),
          ...(notes !== undefined && { notes }),
        },
        include: { category: { select: { name: true } }, account: { select: { name: true } } },
      });
    });

    return res.status(200).json({
      success: true,
      data: { ...updated, formattedAmount: formatINR(updated.amount), message: 'Transaction updated successfully.' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/transactions/:id
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transaction not found.' },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Revert account balance
      if (existing.accountId) {
        const amt = parseFloat(existing.amount);
        const reverseDelta = existing.transactionType === 'INCOME' ? -amt : amt;
        await tx.financialAccount.update({
          where: { id: existing.accountId },
          data: { balance: { increment: reverseDelta } },
        });
      }

      await tx.transaction.delete({ where: { id: req.params.id } });
    });

    return res.status(200).json({
      success: true,
      data: { message: 'Transaction deleted successfully and balance updated.' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/transactions/voice
 * Parse voice entry text into a transaction
 */
const parseVoiceEntry = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Voice text is required.' },
      });
    }

    const parsed = parseVoiceText(text);

    return res.status(200).json({
      success: true,
      data: {
        parsed,
        formattedAmount: formatINR(parsed.amount),
        message: 'Voice entry parsed successfully. Please confirm to save.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Parse natural language into transaction fields
 */
const parseVoiceText = (text) => {
  const lower = text.toLowerCase();

  // Amount detection
  const amountMatch = lower.match(/(?:rs\.?|rupees?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?|₹|inr)?/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

  // Type detection
  let type = 'EXPENSE';
  if (/\b(received?|got|earned?|salary|income|credited?)\b/.test(lower)) type = 'INCOME';

  // Category detection
  const categoryMap = {
    food: ['food', 'eat', 'dinner', 'lunch', 'breakfast', 'restaurant', 'swiggy', 'zomato', 'coffee', 'chai'],
    transport: ['uber', 'ola', 'taxi', 'auto', 'metro', 'bus', 'fuel', 'petrol', 'diesel', 'travel'],
    shopping: ['amazon', 'flipkart', 'myntra', 'shopping', 'clothes', 'bought'],
    entertainment: ['movie', 'netflix', 'hotstar', 'concert', 'game'],
    utilities: ['electricity', 'water', 'bill', 'recharge', 'phone', 'internet'],
    health: ['doctor', 'medicine', 'hospital', 'medical', 'pharmacy'],
    groceries: ['groceries', 'vegetables', 'milk', 'kirana'],
    income: ['salary', 'freelance', 'bonus', 'interest'],
  };

  let category = 'General';
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      category = cat.charAt(0).toUpperCase() + cat.slice(1);
      break;
    }
  }

  // Description — use the original text
  const description = text.trim();

  return { amount, type, category, description };
};

module.exports = {
  getTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  parseVoiceEntry,
};
