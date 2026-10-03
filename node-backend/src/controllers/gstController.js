const gstService = require('../services/gstService');

/**
 * GST Controller
 * Complies with Requirements 19 & 20
 */
const lookupGSTIN = async (req, res, next) => {
  try {
    const { gstin } = req.body;
    if (!gstin) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'GSTIN is required.' },
      });
    }

    const result = await gstService.lookupGSTIN(gstin);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const calculateGST = async (req, res, next) => {
  try {
    const { taxableAmount, gstRatePct, isInterState } = req.body;
    if (!taxableAmount || isNaN(parseFloat(taxableAmount))) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid positive taxable amount is required.' },
      });
    }

    const breakdown = gstService.calculateGSTBreakdown(
      taxableAmount,
      gstRatePct || 18,
      Boolean(isInterState)
    );

    return res.status(200).json({ success: true, data: breakdown });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupGSTIN,
  calculateGST,
};
