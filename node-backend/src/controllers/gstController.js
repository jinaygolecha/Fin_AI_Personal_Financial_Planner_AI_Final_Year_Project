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
    const { taxableAmount, gstRatePct, rate, isInterState, isTaxInclusive, discount = 0 } = req.body;
    const amt = parseFloat(taxableAmount);
    if (!taxableAmount || isNaN(amt) || amt <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid positive taxable amount is required.' },
      });
    }

    const appliedRate = parseFloat(gstRatePct !== undefined ? gstRatePct : (rate !== undefined ? rate : 18));
    const isInter = Boolean(isInterState);

    let baseAmount = amt;
    let totalGst = 0;
    let grossAmount = 0;

    if (isTaxInclusive) {
      grossAmount = amt;
      baseAmount = Math.round((grossAmount / (1 + appliedRate / 100)) * 100) / 100;
      totalGst = Math.round((grossAmount - baseAmount) * 100) / 100;
    } else {
      baseAmount = amt;
      totalGst = Math.round((baseAmount * (appliedRate / 100)) * 100) / 100;
      grossAmount = Math.round((baseAmount + totalGst) * 100) / 100;
    }

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInter) {
      igst = totalGst;
    } else {
      cgst = Math.round((totalGst / 2) * 100) / 100;
      sgst = Math.round((totalGst - cgst) * 100) / 100;
    }

    const breakdown = {
      taxableAmount: baseAmount,
      rate: appliedRate,
      gstRatePct: appliedRate,
      isInterState: isInter,
      cgst,
      sgst,
      igst,
      cgstRate: isInter ? 0 : appliedRate / 2,
      sgstRate: isInter ? 0 : appliedRate / 2,
      igstRate: isInter ? appliedRate : 0,
      totalGst,
      grossAmount,
      totalAmount: grossAmount,
      totalPayable: grossAmount,
      currency: 'INR',
    };

    return res.status(200).json({ success: true, data: breakdown });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupGSTIN,
  calculateGST,
};
