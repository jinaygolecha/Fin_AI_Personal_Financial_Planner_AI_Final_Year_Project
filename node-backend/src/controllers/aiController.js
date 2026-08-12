const aiService = require('../services/aiService');
const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

/**
 * POST /api/v1/ai/chat
 */
const chat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Message cannot be empty.' },
      });
    }

    // Get recent chat history for context
    const recentHistory = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const chatHistory = recentHistory.reverse();

    // Save user message
    await prisma.chatMessage.create({
      data: { userId, role: 'user', content: message.trim() },
    });

    // Get AI response
    const result = await aiService.chat(userId, message.trim(), chatHistory);

    // Save assistant response
    await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: result.response },
    });

    return res.status(200).json({
      success: true,
      data: {
        response: result.response,
        source: result.source,
        context: result.context,
        formatted_net_worth: result.context?.formattedNetWorth || formatINR(result.context?.netWorth || 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/history
 */
const getChatHistory = async (req, res, next) => {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/ai/history
 */
const clearChatHistory = async (req, res, next) => {
  try {
    await prisma.chatMessage.deleteMany({ where: { userId: req.user.id } });
    return res.status(200).json({ success: true, data: { message: 'Chat history cleared.' } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/snapshot
 * Returns the user's financial context (used by the health gauge on the UI)
 */
const getFinancialSnapshot = async (req, res, next) => {
  try {
    const ctx = await aiService.getUserFinancialContext(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        healthScore: ctx.healthScore,
        totalBalance: ctx.totalBalance,
        formattedBalance: formatINR(ctx.totalBalance),
        netWorth: ctx.netWorth,
        formattedNetWorth: formatINR(ctx.netWorth),
        savingsThisMonth: ctx.savingsThisMonth,
        formattedSavings: formatINR(ctx.savingsThisMonth),
        totalDebt: ctx.totalDebt,
        formattedDebt: formatINR(ctx.totalDebt),
        investmentValue: ctx.investmentValue,
        formattedInvestments: formatINR(ctx.investmentValue),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { chat, getChatHistory, clearChatHistory, getFinancialSnapshot };
