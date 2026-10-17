const http = require('http');
const prisma = require('../src/config/database');
const documentIngestionService = require('../src/services/documentIngestionService');
const voiceTransactionService = require('../src/services/voiceTransactionService');
const smsTransactionService = require('../src/services/smsTransactionService');
const gstService = require('../src/services/gstService');
const { formatINR } = require('../src/utils/inr');

/**
 * FINPRO Comprehensive Verification & Regression Test Suite
 * Covers All User Requirements
 */

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path: `/api/v1${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(resData) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('🚀 FINPRO COMPREHENSIVE VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. SETUP / AUTHENTICATION
    console.log('[1/8] Testing Authentication & Session Persistence...');
    const testUsername = `user_${Date.now()}`;
    const testEmail = `${testUsername}@finpro.dev`;
    const testPassword = 'Password123!';

    const regRes = await makeRequest('POST', '/auth/register', {
      username: testUsername,
      name: 'Verification Bot',
      email: testEmail,
      password: testPassword,
    });
    assert(regRes.status === 201 && regRes.body.success, 'User registered successfully');
    const token = regRes.body.data.accessToken;
    const userId = regRes.body.data.user.id;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const loginRes = await makeRequest('POST', '/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    assert(loginRes.status === 200 && loginRes.body.success, 'User logged in successfully with JWT');

    // Create primary bank accounts (SBI and HDFC) for the user
    const sbiAccount = await prisma.financialAccount.create({
      data: { userId, name: 'State Bank of India (SBI)', balance: 50000, currency: 'INR' },
    });
    const hdfcAccount = await prisma.financialAccount.create({
      data: { userId, name: 'HDFC Bank Account', balance: 25000, currency: 'INR' },
    });
    assert(sbiAccount && hdfcAccount, 'Configured synthetic SBI and HDFC bank accounts');

    // 2. BANK STATEMENT CLASSIFICATION & CONFIDENCE TESTS
    console.log('\n[2/8] Testing Bank Statement Classification & Confidence Calculations...');
    
    // Test A: ₹500 Electricity bill paid -> MUST BE EXPENSE
    const sampleCsv = `Date,Description,Debit,Credit,Balance
2026-08-01,Electricity Bill Payment MSEDCL,500.00,,49500.00
2026-08-05,Payment received from customer Aman, ,4000.00,53500.00
2026-08-10,Self transfer from SBI to HDFC,2000.00,,51500.00
2026-08-12,UPI/DR/Swiggy Food Order,450.00,,51050.00
`;
    const parsedCsv = await documentIngestionService.processStatementCSV({
      userId,
      csvContent: sampleCsv,
      accountId: sbiAccount.id,
    });

    assert(parsedCsv.validRows.length === 4, 'Parsed 4 statement rows');
    
    const elecBill = parsedCsv.validRows.find(r => r.description.includes('Electricity'));
    assert(elecBill && elecBill.type === 'EXPENSE', '₹500 Electricity bill paid is strictly classified as EXPENSE');
    assert(elecBill && elecBill.confidence <= 100 && elecBill.confidence >= 0, `Electricity confidence is within [0, 100]%: ${elecBill?.confidence}%`);

    const custPay = parsedCsv.validRows.find(r => r.description.includes('customer'));
    assert(custPay && custPay.type === 'INCOME', '₹4,000 Payment received from customer is strictly classified as INCOME');

    const selfTransfer = parsedCsv.validRows.find(r => r.description.includes('Self transfer'));
    assert(selfTransfer && selfTransfer.type === 'TRANSFER', 'Self transfer is strictly classified as TRANSFER');

    // Test Remarks persistence
    const importCommitRes = await makeRequest('POST', '/import/confirm', {
      accountId: sbiAccount.id,
      rows: [
        {
          date: '2026-08-01',
          description: 'Electricity Bill Payment MSEDCL',
          amount: 500,
          type: 'EXPENSE',
          category: 'Utilities',
          remarks: 'August office electricity deductible',
        },
      ],
    }, authHeaders);

    assert(importCommitRes.status === 200 && importCommitRes.body.success, 'Imported statement row with remarks');

    const savedTx = await prisma.transaction.findFirst({
      where: { userId, description: 'Electricity Bill Payment MSEDCL' },
    });
    assert(savedTx && savedTx.notes === 'August office electricity deductible', 'Remarks survived database commit');

    // 3. GST CALCULATOR - MATHEMATICALLY CORRECT CALCULATION ENGINE
    console.log('\n[3/8] Testing GST Calculator Engine & Precision...');
    
    // Intra-state supply: ₹20,000 at 12% GST
    const intraGstRes = await makeRequest('POST', '/gst/calculate', {
      taxableAmount: 20000,
      gstRatePct: 12,
      isInterState: false,
    }, authHeaders);

    assert(intraGstRes.status === 200 && intraGstRes.body.success, 'Intra-state GST calculation API returned 200');
    const dIntra = intraGstRes.body.data;
    assert(dIntra.taxableAmount === 20000, `Intra-state taxable amount is 20,000 (got ${dIntra.taxableAmount})`);
    assert(dIntra.gstRatePct === 12, `Intra-state GST rate is 12% (got ${dIntra.gstRatePct}%)`);
    assert(dIntra.cgst === 1200, `Intra-state CGST is ₹1,200 (got ₹${dIntra.cgst})`);
    assert(dIntra.sgst === 1200, `Intra-state SGST is ₹1,200 (got ₹${dIntra.sgst})`);
    assert(dIntra.igst === 0, `Intra-state IGST is ₹0 (got ₹${dIntra.igst})`);
    assert(dIntra.totalGst === 2400, `Intra-state total GST is ₹2,400 (got ₹${dIntra.totalGst})`);
    assert(dIntra.totalPayable === 22400, `Intra-state total payable is ₹22,400 (got ₹${dIntra.totalPayable})`);
    assert(dIntra.rate !== undefined && dIntra.totalAmount !== undefined, 'No undefined% or missing totalAmount bindings');

    // Inter-state supply: ₹20,000 at 12% GST
    const interGstRes = await makeRequest('POST', '/gst/calculate', {
      taxableAmount: 20000,
      gstRatePct: 12,
      isInterState: true,
    }, authHeaders);

    const dInter = interGstRes.body.data;
    assert(dInter.cgst === 0 && dInter.sgst === 0, 'Inter-state has CGST=0 and SGST=0');
    assert(dInter.igst === 2400, `Inter-state IGST is ₹2,400 (got ₹${dInter.igst})`);
    assert(dInter.totalPayable === 22400, `Inter-state total payable is ₹22,400 (got ₹${dInter.totalPayable})`);

    // Invalid input test
    const invalidGstRes = await makeRequest('POST', '/gst/calculate', {
      taxableAmount: -500,
      gstRatePct: 12,
    }, authHeaders);
    assert(invalidGstRes.status === 400, 'Negative amount rejected with 400 VALIDATION_ERROR');

    // 4. CREDIT HEALTH & CIBIL FEATURE
    console.log('\n[4/8] Testing Credit Health & CIBIL Indicator...');
    const creditRes = await makeRequest('GET', '/credit-score', null, authHeaders);
    assert(creditRes.status === 200 && creditRes.body.success, 'Credit health API returned 200');
    assert(creditRes.body.data && typeof creditRes.body.data.score === 'number', `Credit score object contains valid score number (${creditRes.body.data?.score})`);
    assert(creditRes.body.data?.score >= 300 && creditRes.body.data?.score <= 900, 'Credit score is in standard bureau range (300-900)');
    assert(creditRes.body.data.disclaimer && creditRes.body.data.disclaimer.toLowerCase().includes('educational'), 'Clear educational estimate disclaimer present');

    // 5. VOICE TRANSACTION ENTRY
    console.log('\n[5/8] Testing Voice-Based Transaction Entry Engine...');
    
    // Command 1: "Received 4,000 rupees in my SBI account from a customer."
    const voiceIncome = await voiceTransactionService.parseVoiceTransaction(userId, 'Received 4,000 rupees in my SBI account from a customer.');
    assert(voiceIncome.amount === 4000, `Voice parsed amount 4,000 (got ${voiceIncome.amount})`);
    assert(voiceIncome.transactionType === 'INCOME', `Voice direction is INCOME (got ${voiceIncome.transactionType})`);
    assert(voiceIncome.matchedAccountId === sbiAccount.id, `Voice matched SBI account correctly (${voiceIncome.matchedAccountName})`);

    // Command 2: "Paid 850 rupees for groceries from my HDFC account."
    const voiceExpense = await voiceTransactionService.parseVoiceTransaction(userId, 'Paid 850 rupees for groceries from my HDFC account.');
    assert(voiceExpense.amount === 850, `Voice parsed amount 850 (got ${voiceExpense.amount})`);
    assert(voiceExpense.transactionType === 'EXPENSE', `Voice direction is EXPENSE (got ${voiceExpense.transactionType})`);
    assert(voiceExpense.category === 'Food & Dining', `Voice category identified as Food & Dining (got ${voiceExpense.category})`);

    // Command 3: "Transferred 5,000 rupees from SBI to HDFC."
    const voiceTransfer = await voiceTransactionService.parseVoiceTransaction(userId, 'Transferred 5,000 rupees from SBI to HDFC.');
    assert(voiceTransfer.amount === 5000, `Voice parsed amount 5,000 (got ${voiceTransfer.amount})`);
    assert(voiceTransfer.transactionType === 'TRANSFER', `Voice direction is TRANSFER (got ${voiceTransfer.transactionType})`);

    // Test API Commit of Voice Transaction
    const voiceCommitRes = await makeRequest('POST', '/ai/voice-commit', {
      amount: 4000,
      transactionType: 'INCOME',
      accountId: sbiAccount.id,
      category: 'Income',
      description: 'Customer payment received via voice',
      remarks: 'Voice confirmed order #9218',
    }, authHeaders);

    assert(voiceCommitRes.status === 201 && voiceCommitRes.body.success, 'Committed voice transaction via API');
    
    // Verify SBI Account balance was incremented
    const updatedSbi = await prisma.financialAccount.findUnique({ where: { id: sbiAccount.id } });
    assert(Number(updatedSbi.balance) === 53500, `SBI balance updated atomically: expected ₹53,500 (50k - 500 bill + 4k income), got ₹${updatedSbi.balance}`);

    // 6. BANK SMS TRANSACTION IMPORT & FILTERS
    console.log('\n[6/8] Testing Bank SMS Import, Privacy Filters & Deduplication...');

    // Filter A: OTP Rejection
    const otpSmsRes = await makeRequest('POST', '/import/sms-parse', {
      smsText: 'Your OTP for transaction of INR 3,500.00 is 849201. Do not share this OTP with anyone.',
    }, authHeaders);
    assert(otpSmsRes.status === 422 && otpSmsRes.body.error.code === 'SECURITY_EXCLUSION', 'OTP message was strictly rejected for security & privacy');

    // Filter B: Promotional Rejection
    const promoSmsRes = await makeRequest('POST', '/import/sms-parse', {
      smsText: 'Congratulations! You are pre-approved for a personal loan of up to Rs 5,00,000. Apply now!',
    }, authHeaders);
    assert(promoSmsRes.status === 422 && promoSmsRes.body.error.code === 'PROMOTIONAL_EXCLUSION', 'Promotional message strictly rejected');

    // Filter C: Balance Only Query Rejection
    const balOnlyRes = await makeRequest('POST', '/import/sms-parse', {
      smsText: 'Dear Customer, the available balance in your A/C XX4921 is INR 38,400.00 as of 15-Aug.',
    }, authHeaders);
    assert(balOnlyRes.status === 422 && balOnlyRes.body.error.code === 'BALANCE_ONLY', 'Balance query without debit/credit rejected');

    // Valid Bank Debit SMS Extraction
    const validSmsText = 'INR 1,500.00 debited from A/C XX4921 on 10-Sep-2026 at SWIGGY via UPI. Ref: UPI/998877665544.';
    const parseSmsRes = await makeRequest('POST', '/import/sms-parse', {
      smsText: validSmsText,
      sender: 'HDFCBK',
    }, authHeaders);

    assert(parseSmsRes.status === 200 && parseSmsRes.body.success, 'Valid bank SMS parsed successfully');
    const smsData = parseSmsRes.body.data;
    assert(smsData.amount === 1500, `SMS amount extracted ₹1,500 (got ${smsData.amount})`);
    assert(smsData.transactionType === 'EXPENSE', `SMS debit direction is EXPENSE (got ${smsData.transactionType})`);
    assert(smsData.referenceId === '998877665544', `SMS reference ID extracted (got ${smsData.referenceId})`);
    assert(smsData.merchant.toLowerCase().includes('swiggy'), `SMS merchant identified as Swiggy (got ${smsData.merchant})`);

    // Commit SMS Transaction to DB
    const commitSmsRes = await makeRequest('POST', '/import/sms-confirm', {
      amount: smsData.amount,
      transactionType: smsData.transactionType,
      accountId: hdfcAccount.id,
      category: 'Food & Dining',
      merchant: smsData.merchant,
      referenceId: smsData.referenceId,
      date: new Date().toISOString(),
    }, authHeaders);

    assert(commitSmsRes.status === 201 && commitSmsRes.body.success, 'Saved SMS transaction to database');

    // Duplicate Detection Check
    const dupCheckRes = await makeRequest('POST', '/import/sms-parse', {
      smsText: validSmsText,
      sender: 'HDFCBK',
    }, authHeaders);
    assert(dupCheckRes.body.data?.isDuplicate === true, 'Duplicate SMS detected via unique reference ID');

    // 7. IN-APP TRANSACTION NOTIFICATIONS
    console.log('\n[7/8] Verifying In-App Transaction Notifications Persistence...');
    const notifs = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    assert(notifs.length >= 3, `Notifications persisted in database (found ${notifs.length})`);
    const voiceNotif = notifs.find(n => n.title.includes('Voice'));
    const smsNotif = notifs.find(n => n.title.includes('SMS'));
    const stmtNotif = notifs.find(n => n.title.includes('Statement'));
    assert(voiceNotif !== undefined, 'Voice transaction notification logged in PostgreSQL');
    assert(smsNotif !== undefined, 'SMS import notification logged in PostgreSQL');
    assert(stmtNotif !== undefined, 'Statement import notification logged in PostgreSQL');

    // 8. MARKET DATA & METALS ACCURACY
    console.log('\n[8/8] Testing Live Market & Pune Retail Metals Conversion...');
    const metalsRes = await makeRequest('GET', '/market/metals', null, authHeaders);
    assert(metalsRes.status === 200 && metalsRes.body.success, 'Metals API returned 200');
    const goldData = metalsRes.body.data?.gold;
    const silverData = metalsRes.body.data?.silver;
    const gold24k = goldData?.karat24?.perGram || goldData?.pricePerGram24K;
    const gold22k = goldData?.karat22?.perGram || goldData?.pricePerGram22K;
    const silverKg = silverData?.perKg || silverData?.pricePerKg;
    assert(gold24k > 10000 && gold24k < 20000, `Gold 24K Pune retail rate realistic: ₹${gold24k}/g`);
    assert(gold22k > 9000 && gold22k < 18000, `Gold 22K Pune retail rate realistic: ₹${gold22k}/g`);
    assert(silverKg > 80000, `Silver price per kg realistic: ₹${silverKg}/kg`);

    console.log('\n======================================================');
    console.log(`🏁 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runSuite();
