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

/**
 * GET /api/v1/ai/investment-analysis
 */
const getInvestmentAnalysis = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [portfolio, profile, accounts] = await Promise.all([
      prisma.portfolio.findUnique({
        where: { userId },
        include: { investments: true },
      }),
      prisma.financialProfile.findUnique({ where: { userId } }),
      prisma.financialAccount.findMany({ where: { userId, isActive: true } }),
    ]);

    const holdings = portfolio?.investments || [];
    const totalInvested = holdings.reduce((sum, h) => sum + (parseFloat(h.quantity) * parseFloat(h.averageBuyPrice)), 0);
    const cashBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);

    let equityValue = 0;
    let goldValue = 0;
    let cryptoValue = 0;
    let otherValue = 0;

    holdings.forEach(h => {
      const val = parseFloat(h.quantity) * parseFloat(h.averageBuyPrice);
      if (h.assetType === 'STOCK' || h.assetType === 'MUTUAL_FUND' || h.assetType === 'ETF') equityValue += val;
      else if (h.assetType === 'GOLD') goldValue += val;
      else if (h.assetType === 'CRYPTO') cryptoValue += val;
      else otherValue += val;
    });

    const totalAssets = totalInvested + cashBalance;
    const equityPct = totalAssets > 0 ? Math.round((equityValue / totalAssets) * 100) : 0;
    const goldPct = totalAssets > 0 ? Math.round((goldValue / totalAssets) * 100) : 0;
    const cryptoPct = totalAssets > 0 ? Math.round((cryptoValue / totalAssets) * 100) : 0;
    const cashPct = totalAssets > 0 ? Math.round((cashBalance / totalAssets) * 100) : 0;

    const riskProfile = profile?.riskProfile || 'MODERATE';
    const insights = [];

    if (equityPct > 70 && riskProfile === 'CONSERVATIVE') {
      insights.push('Your equity exposure is higher than recommended for a conservative risk profile.');
    } else if (equityPct < 30 && riskProfile === 'AGGRESSIVE') {
      insights.push('Your equity exposure is relatively low for an aggressive long-term wealth creation strategy.');
    }

    if (goldPct < 5) {
      insights.push('Consider holding 5-10% of your portfolio in Gold/Precious Metals for inflation hedging.');
    }

    if (cashPct > 50) {
      insights.push('High cash allocation detected. Consider systematic investment (SIP) to avoid inflation drag.');
    }

    if (insights.length === 0) {
      insights.push('Your asset allocation is balanced across current holdings.');
    }

    return res.status(200).json({
      success: true,
      data: {
        totalInvested,
        formattedTotalInvested: formatINR(totalInvested),
        cashBalance,
        formattedCashBalance: formatINR(cashBalance),
        riskProfile,
        allocation: {
          equity: { percentage: equityPct, value: equityValue, formatted: formatINR(equityValue) },
          gold: { percentage: goldPct, value: goldValue, formatted: formatINR(goldValue) },
          crypto: { percentage: cryptoPct, value: cryptoValue, formatted: formatINR(cryptoValue) },
          cash: { percentage: cashPct, value: cashBalance, formatted: formatINR(cashBalance) },
          other: { percentage: 100 - (equityPct + goldPct + cryptoPct + cashPct), value: otherValue, formatted: formatINR(otherValue) },
        },
        diversificationScore: holdings.length >= 5 ? 'Good' : holdings.length >= 2 ? 'Moderate' : 'Low',
        insights,
        disclaimer: 'AI-generated educational guidance. Not guaranteed investment advice.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/insurance-review
 */
const getInsuranceReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [policies, profile, loans] = await Promise.all([
      prisma.insurancePolicy.findMany({ where: { userId, isActive: true } }),
      prisma.financialProfile.findUnique({ where: { userId } }),
      prisma.loan.findMany({ where: { userId, status: 'ACTIVE' } }),
    ]);

    const annualSalary = (parseFloat(profile?.monthlySalary || 0)) * 12;
    const recommendedLifeCover = annualSalary * 10;
    const totalDebt = loans.reduce((sum, l) => sum + parseFloat(l.outstandingBalance), 0);

    const lifePolicies = policies.filter(p => p.policyType === 'LIFE');
    const healthPolicies = policies.filter(p => p.policyType === 'HEALTH');

    const totalLifeCover = lifePolicies.reduce((sum, p) => sum + parseFloat(p.coverageAmount), 0);
    const totalHealthCover = healthPolicies.reduce((sum, p) => sum + parseFloat(p.coverageAmount), 0);

    const recommendations = [];

    if (annualSalary > 0 && totalLifeCover < (recommendedLifeCover + totalDebt)) {
      recommendations.push(`Life coverage of ${formatINR(totalLifeCover)} is below recommended term cover (${formatINR(recommendedLifeCover + totalDebt)} including active liabilities).`);
    }

    if (totalHealthCover < 500000) {
      recommendations.push('Health coverage is under ₹5,00,000. Consider adequate base health or top-up insurance for family security.');
    }

    if (policies.length === 0) {
      recommendations.push('No active insurance policies registered. Please review essential health and term life protection.');
    }

    return res.status(200).json({
      success: true,
      data: {
        totalLifeCover,
        formattedTotalLifeCover: formatINR(totalLifeCover),
        totalHealthCover,
        formattedTotalHealthCover: formatINR(totalHealthCover),
        recommendedLifeCover: recommendedLifeCover + totalDebt,
        formattedRecommendedLifeCover: formatINR(recommendedLifeCover + totalDebt),
        totalPolicies: policies.length,
        recommendations,
        disclaimer: 'AI educational guidance. Please consult certified insurance advisors for customized policy underwriting.',
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  getChatHistory,
  clearChatHistory,
  getFinancialSnapshot,
  getInvestmentAnalysis,
  getInsuranceReview,
};
