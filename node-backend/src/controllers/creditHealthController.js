const creditHealthService = require('../services/creditHealthService');

/**
 * Credit Health & CIBIL Controller
 * Complies with Requirement 18:
 * - Layer 1: Internal FinPro Credit Health Indicator (300-900)
 * - Layer 2: Official CIBIL bureau integration status
 * - Layer 3: Educational reference
 */
const getCreditScore = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await creditHealthService.evaluateCreditHealth(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCreditScore,
};
