const financialTwin = require('../services/financialTwinService');
const prisma = require('../config/database');

/**
 * Simulation & Forecasting Controller
 * Owner: Jinay Golecha (jinay_golecha)
 */

/**
 * POST /api/v1/ai/simulate
 */
const simulateScenario = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      scenarioName,
      scenarioType,
      salaryChangePercent,
      expenseChangePercent,
      extraMonthlyInvestment,
      loanPrepaymentAmount,
      majorPurchaseAmount,
    } = req.body;

    const result = await financialTwin.simulateScenario(userId, {
      scenarioName: scenarioName || 'Custom Simulation',
      scenarioType: scenarioType || 'CUSTOM',
      salaryChangePercent: parseFloat(salaryChangePercent) || 0,
      expenseChangePercent: parseFloat(expenseChangePercent) || 0,
      extraMonthlyInvestment: parseFloat(extraMonthlyInvestment) || 0,
      loanPrepaymentAmount: parseFloat(loanPrepaymentAmount) || 0,
      majorPurchaseAmount: parseFloat(majorPurchaseAmount) || 0,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/simulations/history
 */
const getSimulationHistory = async (req, res, next) => {
  try {
    const history = await prisma.financialSimulation.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/ai/retirement-plan
 */
const getRetirementPlan = async (req, res, next) => {
  try {
    const {
      currentAge = 25,
      retirementAge = 60,
      currentSavings = 500000,
      monthlyContribution = 15000,
      inflationRate = 6,
      expectedReturn = 12,
      targetMonthlyExpenseInRetirement = 50000,
    } = req.body;

    const plan = financialTwin.planRetirement({
      currentAge: parseInt(currentAge),
      retirementAge: parseInt(retirementAge),
      currentSavings: parseFloat(currentSavings),
      monthlyContribution: parseFloat(monthlyContribution),
      inflationRate: parseFloat(inflationRate),
      expectedReturn: parseFloat(expectedReturn),
      targetMonthlyExpenseInRetirement: parseFloat(targetMonthlyExpenseInRetirement),
    });

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/ai/goals/:id/forecast
 */
const getGoalForecast = async (req, res, next) => {
  try {
    const goal = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!goal) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Goal not found' } });
    }

    const forecast = financialTwin.forecastGoal(goal);
    return res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  simulateScenario,
  getSimulationHistory,
  getRetirementPlan,
  getGoalForecast,
};
