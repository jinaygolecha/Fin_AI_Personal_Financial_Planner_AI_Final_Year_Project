/**
 * FinPro Comprehensive Backend Repair Verification Suite
 * Tests:
 * 1. Google OAuth CSRF State creation, tampering detection & expiration
 * 2. Receipt OCR Engine with 15 fields, mathematical consistency & validation
 * 3. Bank Statement Parser: Indian date formats, parenthesis numbers & narration tokens
 * 4. GST Controller & Calculations: Discounts, other charges, inclusive vs exclusive, intra vs inter-state
 */

const assert = require('assert');
const receiptOcrService = require('./src/services/receiptOcrService');
const documentIngestionService = require('./src/services/documentIngestionService');
const gstService = require('./src/services/gstService');
const authService = require('./src/services/authService');

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING COMPREHENSIVE REPAIR VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
    }
  }

  // ----------------------------------------------------
  // SECTION 1: Google OAuth Security & State Handling
  // ----------------------------------------------------
  console.log('\n--- Section 1: Google OAuth Cryptographic CSRF State ---');
  
  test('OAuth state contains returnTo and nonce', () => {
    const state = authService.generateOAuthState('/dashboard.html');
    assert(typeof state === 'string' && state.length > 20, 'State must be a signed token');
    const verified = authService.verifyOAuthState(state);
    assert.strictEqual(verified.returnTo, '/dashboard.html');
    assert(verified.nonce, 'Nonce must be present');
  });

  test('Tampered OAuth state is rejected', () => {
    const state = authService.generateOAuthState('/dashboard.html');
    const tampered = state.slice(0, -5) + 'abcde';
    assert.throws(() => {
      authService.verifyOAuthState(tampered);
    }, /INVALID_OAUTH_STATE|Invalid/);
  });

  // ----------------------------------------------------
  // SECTION 2: Receipt OCR Engine & Multi-Field Extraction
  // ----------------------------------------------------
  console.log('\n--- Section 2: Receipt OCR Extraction & Validation ---');

  const sampleReceiptText = `
    THE BOMBAY CANTEEN
    Invoice No: INV-2026-8849
    Date: 16/08/2026 Time: 21:30:00
    GSTIN: 27AABCT3518Q1ZV
    
    1x Roasted Cauliflower  Rs 450.00
    2x Craft Beer           Rs 900.00
    1x Gulab Jamun Tart     Rs 350.00
    
    Subtotal: Rs 1700.00
    Discount: Rs 100.00
    Taxable Value: Rs 1600.00
    CGST (2.5%): Rs 40.00
    SGST (2.5%): Rs 40.00
    Service Charge: Rs 160.00
    Grand Total: Rs 1840.00
    Payment Method: UPI / GPay
  `;

  test('Fallback Regex extracts all 15 structured fields', () => {
    const res = receiptOcrService.parseReceiptText(sampleReceiptText);
    
    assert(res.merchant.toLowerCase().includes('bombay canteen'), 'Merchant match failed');
    assert.strictEqual(res.invoiceNumber, 'INV-2026-8849', 'Invoice match failed');
    assert.strictEqual(res.date, '2026-08-16', 'Date match failed');
    assert.strictEqual(res.time, '21:30:00', 'Time match failed');
    assert.strictEqual(res.currency, 'INR', 'Currency match failed');
    assert.strictEqual(res.gstin, '27AABCT3518Q1ZV', 'GSTIN match failed');
    assert.strictEqual(res.subtotal, 1700, 'Subtotal match failed');
    assert.strictEqual(res.discount, 100, 'Discount match failed');
    assert.strictEqual(res.taxableValue, 1600, 'Taxable value match failed');
    assert.strictEqual(res.cgst, 40, 'CGST match failed');
    assert.strictEqual(res.sgst, 40, 'SGST match failed');
    assert.strictEqual(res.totalGst, 80, 'Total GST match failed');
    assert.strictEqual(res.otherCharges, 160, 'Other charges match failed');
    assert.strictEqual(res.totalAmount, 1840, 'Total amount match failed');
    assert.strictEqual(res.paymentMethod, 'UPI', 'Payment method match failed');
    assert.strictEqual(res.category, 'Food & Dining', 'Category match failed');
    assert(res.items.length >= 3, `Expected at least 3 items, found ${res.items.length}`);
    assert.strictEqual(res.validationStatus, 'VALIDATED', 'Validation status should be VALIDATED');
  });

  test('Mathematical inconsistency in receipt is flagged', () => {
    const inconsistentReceipt = `
      SUPERMARKET
      Date: 2026-05-10
      Taxable Value: Rs 1000.00
      CGST: Rs 90.00
      SGST: Rs 90.00
      Total: Rs 2500.00
    `;
    const res = receiptOcrService.parseReceiptText(inconsistentReceipt);
    assert.strictEqual(res.validationStatus, 'INCONSISTENT_TOTALS');
  });

  // ----------------------------------------------------
  // SECTION 3: Bank Statement Parsing & Indian Formats
  // ----------------------------------------------------
  console.log('\n--- Section 3: Bank Statement Parsing ---');

  test('Indian dates parsed correctly (DD-Mon-YYYY & DD/MM/YYYY)', () => {
    assert.strictEqual(documentIngestionService.normalizeDate('16-Aug-2026'), '2026-08-16');
    assert.strictEqual(documentIngestionService.normalizeDate('05 Jan 2026'), '2026-01-05');
    assert.strictEqual(documentIngestionService.normalizeDate('25/12/2025'), '2025-12-25');
    assert.strictEqual(documentIngestionService.normalizeDate('15-08-2026'), '2026-08-15');
  });

  test('Parenthesis debit amounts and Indian currency commas parsed', () => {
    assert.strictEqual(documentIngestionService.normalizeAmount('(1,450.50)'), 1450.5);
    assert.strictEqual(documentIngestionService.normalizeAmount('Rs. 1,25,000.00 Dr'), 125000);
    assert.strictEqual(documentIngestionService.normalizeAmount('INR 5,500.25 Cr'), 5500.25);
  });

  test('Indian bank narration tokens classified into INCOME vs EXPENSE', () => {
    assert.strictEqual(documentIngestionService.detectTransactionType('UPI/CR/329482/Ramesh/Pay', 1000), 'INCOME');
    assert.strictEqual(documentIngestionService.detectTransactionType('UPI/DR/837492/Swiggy/Food', -250), 'EXPENSE');
    assert.strictEqual(documentIngestionService.detectTransactionType('NEFT-INW-SALARY-AUG2026', 150000), 'INCOME');
    assert.strictEqual(documentIngestionService.detectTransactionType('POS 492023 DMART MUMBAI', 3420), 'EXPENSE');
    assert.strictEqual(documentIngestionService.detectTransactionType('ACH/DR/HDFC-HOME-LOAN-EMI', 42000), 'EXPENSE');
    assert.strictEqual(documentIngestionService.detectTransactionType('REFUND FROM FLIPKART', 1499), 'INCOME');
  });

  // ----------------------------------------------------
  // SECTION 4: GST Mathematical Correctness
  // ----------------------------------------------------
  console.log('\n--- Section 4: GST Mathematical Correctness ---');

  test('Intra-state standard calculation (CGST + SGST 50/50)', () => {
    const res = gstService.calculateGST({ amount: 10000, rate: 18, isInterState: false });
    assert.strictEqual(res.taxableAmount, 10000);
    assert.strictEqual(res.cgst, 900);
    assert.strictEqual(res.sgst, 900);
    assert.strictEqual(res.igst, 0);
    assert.strictEqual(res.totalGst, 1800);
    assert.strictEqual(res.totalAmount, 11800);
  });

  test('Inter-state standard calculation (IGST 100%)', () => {
    const res = gstService.calculateGST({ amount: 10000, rate: 18, isInterState: true });
    assert.strictEqual(res.taxableAmount, 10000);
    assert.strictEqual(res.cgst, 0);
    assert.strictEqual(res.sgst, 0);
    assert.strictEqual(res.igst, 1800);
    assert.strictEqual(res.totalGst, 1800);
    assert.strictEqual(res.totalAmount, 11800);
  });

  test('GST with discount and other charges (tax-exclusive)', () => {
    // Base 10000, discount 1000 -> Taxable 9000. Rate 18% -> GST 1620. Other charges 500 -> Total 9000 + 1620 + 500 = 11120
    const res = gstService.calculateGST({
      taxableAmount: 10000,
      rate: 18,
      isInterState: false,
      discount: 1000,
      otherCharges: 500
    });
    assert.strictEqual(res.discount, 1000);
    assert.strictEqual(res.otherCharges, 500);
    assert.strictEqual(res.taxableAmount, 9000);
    assert.strictEqual(res.cgst, 810);
    assert.strictEqual(res.sgst, 810);
    assert.strictEqual(res.totalGst, 1620);
    assert.strictEqual(res.totalAmount, 11120);
  });

  test('Tax-inclusive reverse calculation with discount & freight', () => {
    // Let net total = 11120, other charges = 500, discount = 1000.
    // In reverse inclusive calculation: (11120 - 500) = 10620 (taxable + 18% GST).
    // Taxable = 10620 / 1.18 = 9000.
    // GST = 1620 (810 CGST + 810 SGST).
    // Gross = 9000 + 1000 discount = 10000.
    const res = gstService.calculateGST({
      taxableAmount: 11120,
      rate: 18,
      isInterState: false,
      isInclusive: true,
      discount: 1000,
      otherCharges: 500
    });
    assert.strictEqual(res.taxableAmount, 9000);
    assert.strictEqual(res.cgst, 810);
    assert.strictEqual(res.sgst, 810);
    assert.strictEqual(res.totalGst, 1620);
    assert.strictEqual(res.totalAmount, 11120);
  });

  test('Detailed multi-line items tax invoice calculation', () => {
    const lineItems = [
      { description: 'Laptop', quantity: 1, unitPrice: 50000, rate: 18 },
      { description: 'Books', quantity: 2, unitPrice: 500, rate: 0 },
      { description: 'Keyboard', quantity: 1, unitPrice: 2000, rate: 18 }
    ];
    const res = gstService.calculateDetailedTaxInvoice({
      items: lineItems,
      discount: 2000,
      otherCharges: 300,
      isInterState: false
    });
    assert.strictEqual(res.itemCount, 3);
    assert.strictEqual(res.subtotal, 53000); // 50000 + 1000 + 2000
    assert.strictEqual(res.discount, 2000);
    assert.strictEqual(res.otherCharges, 300);
    assert(res.totalGst > 0);
    assert(res.totalAmount > res.subtotal - res.discount);
  });

  test('GSTIN checksum validation and jurisdiction extraction', () => {
    const validRes = gstService.verifyGstin('27AAPFU0939F1ZV');
    assert.strictEqual(validRes.isValid, true);
    assert.strictEqual(validRes.stateCode, '27');
    assert.strictEqual(validRes.state, 'Maharashtra');
    assert.strictEqual(validRes.pan, 'AAPFU0939F');

    const invalidRes = gstService.verifyGstin('INVALIDGSTIN999');
    assert.strictEqual(invalidRes.isValid, false);
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
