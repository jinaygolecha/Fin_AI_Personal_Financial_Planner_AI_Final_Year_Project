const gstService = require('../services/gstService');

/**
 * GST Controller
 * Provides mathematically correct GST tax computation, itemized invoice analysis,
 * and Indian GSTIN verification.
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
    const {
      taxableAmount,
      amount,
      gstRatePct,
      rate,
      isInterState,
      isTaxInclusive,
      discount = 0,
      otherCharges = 0,
      lineItems,
      merchant,
      gstin,
      invoiceNumber,
      placeOfSupply,
    } = req.body;

    // If itemized line items are provided, execute full multi-item invoice calculator
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      const detailedInvoice = gstService.calculateDetailedTaxInvoice({
        merchant: merchant || 'Retail Supplier',
        gstin: gstin || null,
        invoiceNumber: invoiceNumber || null,
        placeOfSupply: placeOfSupply || null,
        isTaxInclusive: Boolean(isTaxInclusive),
        lineItems,
        otherCharges: parseFloat(otherCharges) || 0,
      });

      return res.status(200).json({ success: true, data: detailedInvoice });
    }

    // Single-amount calculation
    const rawAmt = taxableAmount !== undefined ? taxableAmount : amount;
    const amt = parseFloat(rawAmt);
    if (!rawAmt || isNaN(amt) || amt <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid positive taxable amount is required.' },
      });
    }

    const appliedRate = parseFloat(gstRatePct !== undefined ? gstRatePct : (rate !== undefined ? rate : 18));
    const isInter = Boolean(isInterState);
    const disc = Math.max(0, parseFloat(discount) || 0);
    const extraCharges = Math.max(0, parseFloat(otherCharges) || 0);

    let baseAmount = 0;
    let totalGst = 0;
    let grossAmount = 0;

    if (isTaxInclusive) {
      // Amount entered already includes GST
      const grossAfterDisc = Math.max(0, amt - disc);
      baseAmount = Math.round((grossAfterDisc / (1 + appliedRate / 100)) * 100) / 100;
      totalGst = Math.round((grossAfterDisc - baseAmount) * 100) / 100;
      grossAmount = Math.round((grossAfterDisc + extraCharges) * 100) / 100;
    } else {
      // Amount entered is exclusive of GST: Tax applied on (Amount - Discount)
      baseAmount = Math.max(0, Math.round((amt - disc) * 100) / 100);
      totalGst = Math.round((baseAmount * (appliedRate / 100)) * 100) / 100;
      grossAmount = Math.round((baseAmount + totalGst + extraCharges) * 100) / 100;
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
      originalAmount: amt,
      discount: disc,
      taxableAmount: baseAmount,
      netTaxableAmount: baseAmount,
      rate: appliedRate,
      gstRatePct: appliedRate,
      isInterState: isInter,
      isTaxInclusive: Boolean(isTaxInclusive),
      supplyType: isInter ? 'INTER_STATE (IGST)' : 'INTRA_STATE (CGST + SGST)',
      pricingBasis: isTaxInclusive ? 'TAX_INCLUSIVE_PRICING' : 'TAX_EXCLUSIVE_PRICING',
      cgst,
      sgst,
      igst,
      cgstRate: isInter ? 0 : appliedRate / 2,
      sgstRate: isInter ? 0 : appliedRate / 2,
      igstRate: isInter ? appliedRate : 0,
      totalGst,
      otherCharges: extraCharges,
      grossAmount,
      totalAmount: grossAmount,
      totalPayable: grossAmount,
      currency: 'INR',
      legalDisclaimer: 'Algorithmic tax analysis for personal expense estimation. Not an official statutory tax audit.',
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
