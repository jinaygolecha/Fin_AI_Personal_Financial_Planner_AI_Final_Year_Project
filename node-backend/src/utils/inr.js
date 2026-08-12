/**
 * INR (Indian Rupee) Formatting Utilities
 * Owner: Jinay Golecha (jinay_golecha)
 * Locale: en-IN | Currency: INR
 */

/**
 * Format a number as Indian Rupee with Indian numbering system
 * e.g., 150000 → "₹1,50,000.00"
 */
const formatINR = (amount, showDecimals = true) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num);
};

/**
 * Format a number using Indian numbering system (no currency symbol)
 * e.g., 150000 → "1,50,000"
 */
const formatINRNumber = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN').format(num);
};

/**
 * Parse a numeric value from string safely — always returns a number, never NaN
 */
const safeParseFloat = (val, fallback = 0) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Add two Decimal-safe numbers (to avoid JS float issues for display)
 */
const addMoney = (a, b) => Math.round((safeParseFloat(a) + safeParseFloat(b)) * 100) / 100;

/**
 * Subtract two Decimal-safe numbers
 */
const subtractMoney = (a, b) => Math.round((safeParseFloat(a) - safeParseFloat(b)) * 100) / 100;

module.exports = { formatINR, formatINRNumber, safeParseFloat, addMoney, subtractMoney };
