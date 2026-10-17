const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

/**
 * Bank SMS Transaction Ingestion & Validation Service
 * Android-First / Web Paste Architecture
 */
class SmsTransactionService {
  /**
   * Filters and parses an incoming bank SMS message
   */
  async parseSms(userId, rawText, sender = '') {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        isValid: false,
        error: 'EMPTY_MESSAGE',
        message: 'No SMS message content provided.',
      };
    }

    const text = rawText.trim();
    const lower = text.toLowerCase();

    // 1. SECURITY & PRIVACY FILTER: Exclude OTPs, 2FA, PINs, Passwords immediately
    const isOtp = /\b(otp|one time password|verification code|secret code|do not share|valid for \d+ min|authorization code|login code|passcode|security pin)\b/i.test(lower);
    if (isOtp) {
      return {
        isValid: false,
        exclusionType: 'SECURITY_EXCLUSION',
        message: 'Message contains an OTP or security token. Excluded from processing for your privacy and security.',
      };
    }

    // 2. PROMOTIONAL / MARKETING FILTER
    const isPromo = /\b(pre-approved|apply now|congratulations|exclusive offer|claim now|win cash|lottery|discount coupon|cash reward|click here|hurry)\b/i.test(lower) && !/\b(debited|credited)\b/i.test(lower);
    if (isPromo) {
      return {
        isValid: false,
        exclusionType: 'PROMOTIONAL_EXCLUSION',
        message: 'Promotional or advertisement notification. Not an actual financial transaction alert.',
      };
    }

    // 3. BALANCE QUERY ONLY (No transaction action)
    const isBalanceOnly = /\b(available balance|available bal|avl bal|clear balance|clear bal|account balance|account bal|balance is|current balance)\b/i.test(lower) &&
      !/\b(debited|credited|withdrawn|spent|paid|received|deposited|transfer)\b/i.test(lower);
    if (isBalanceOnly) {
      return {
        isValid: false,
        exclusionType: 'BALANCE_ONLY',
        message: 'Notification only reports account balance without a debit or credit transaction.',
      };
    }

    // 4. TRANSACTION DIRECTION (Debit vs Credit)
    const isDebit = /\b(debited|debit|spent|paid|withdrawn|deducted|charged|sent to|dr)\b/i.test(lower);
    const isCredit = /\b(credited|credit|received|deposit|deposited|refund|cashback|cr)\b/i.test(lower);

    if (!isDebit && !isCredit) {
      return {
        isValid: false,
        exclusionType: 'UNRECOGNIZED_ACTION',
        message: 'Could not reliably determine whether this message represents a debit or credit transaction.',
      };
    }

    const transactionType = isCredit ? 'INCOME' : 'EXPENSE';

    // 5. AMOUNT EXTRACTION
    let amount = null;
    const amtRegex = /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
    const matchAmt = lower.match(amtRegex);
    if (matchAmt && matchAmt[1]) {
      const parsed = parseFloat(matchAmt[1].replace(/,/g, ''));
      if (!isNaN(parsed) && parsed > 0) amount = parsed;
    }

    if (!amount) {
      const altAmtRegex = /(?:debited|credited|spent|withdrawn|paid)\s+(?:for\s+)?([0-9,]+(?:\.[0-9]{1,2})?)/i;
      const matchAlt = lower.match(altAmtRegex);
      if (matchAlt && matchAlt[1]) {
        const parsed = parseFloat(matchAlt[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) amount = parsed;
      }
    }

    if (!amount || amount <= 0) {
      return {
        isValid: false,
        exclusionType: 'MISSING_AMOUNT',
        message: 'Could not extract a valid financial amount from the message.',
      };
    }

    // 6. BANK & ACCOUNT NUMBER EXTRACTION
    let bankName = 'Bank Account';
    const senderLower = (sender || '').toLowerCase();
    if (senderLower.includes('hdfc') || lower.includes('hdfc')) bankName = 'HDFC Bank';
    else if (senderLower.includes('sbi') || lower.includes('sbi')) bankName = 'State Bank of India';
    else if (senderLower.includes('icici') || lower.includes('icici')) bankName = 'ICICI Bank';
    else if (senderLower.includes('axis') || lower.includes('axis')) bankName = 'Axis Bank';
    else if (senderLower.includes('kotak') || lower.includes('kotak')) bankName = 'Kotak Mahindra Bank';
    else if (senderLower.includes('pnb') || lower.includes('pnb')) bankName = 'Punjab National Bank';
    else if (senderLower.includes('bob') || lower.includes('baroda')) bankName = 'Bank of Baroda';

    let accountSuffix = null;
    const accMatch = lower.match(/(?:a\/c|account|acct|acc)(?:\s*(?:no\.?|ending|number))?\s*[:=]?\s*[*xX]*([0-9]{3,4})/i) ||
                     lower.match(/[*xX]{3,}([0-9]{3,4})/i);
    if (accMatch && accMatch[1]) {
      accountSuffix = accMatch[1];
    }

    // 7. REFERENCE NUMBER / UPI UTR EXTRACTION
    let referenceId = null;
    const refMatch = text.match(/(?:upi\s*ref|ref\s*(?:no\.?|id|num)?|rrn|txn\s*(?:id|no\.?)|utr|reference)\s*[:=\s]+(?:upi[\/:])?([a-zA-Z0-9]+)/i);
    if (refMatch && refMatch[1]) {
      referenceId = refMatch[1].toUpperCase();
    }

    // 8. MERCHANT / BENEFICIARY EXTRACTION
    let merchant = null;
    const toMatch = text.match(/(?:to|info\/|at|paid to|vpa)\s+([A-Za-z0-9\s._@'-]+?)(?:\s+(?:on|ref|upi|avl|bal|ending|via)|[.,;]|$)/i);
    if (toMatch && toMatch[1]) {
      const candidate = toMatch[1].trim();
      if (candidate.length > 2 && !/^(?:the|an|a|your|my)$/i.test(candidate)) {
        merchant = candidate;
      }
    }
    if (!merchant && transactionType === 'INCOME') {
      const fromMatch = text.match(/(?:from|by)\s+([A-Za-z0-9\s._@'-]+?)(?:\s+(?:on|ref|upi|avl|bal|ending|via)|[.,;]|$)/i);
      if (fromMatch && fromMatch[1]) merchant = fromMatch[1].trim();
    }
    if (!merchant) {
      merchant = transactionType === 'INCOME' ? 'Incoming Transfer' : (bankName ? `${bankName} Payment` : 'Merchant');
    }

    // 9. CATEGORY GUESS
    let category = 'Other';
    const mLower = merchant.toLowerCase();
    if (/swiggy|zomato|starbucks|mcdonald|food|hotel|restaurant|cafe/i.test(mLower) || /dining|grocer/i.test(lower)) {
      category = 'Food & Dining';
    } else if (/electricity|power|bescom|tneb|discom|water|gas|utility|bill/i.test(mLower) || /billdesk|bbps/i.test(lower)) {
      category = 'Utilities';
    } else if (/salary|payroll|wages/i.test(mLower) || /salary/i.test(lower)) {
      category = 'Salary';
    } else if (/petrol|fuel|uber|ola|metro|irctc|railway|transport/i.test(mLower) || /fuel/i.test(lower)) {
      category = 'Transportation';
    } else if (/amazon|flipkart|myntra|zara|retail|store|dmart/i.test(mLower)) {
      category = 'Shopping';
    } else if (/zerodha|groww|upstox|mutual|sip|stock/i.test(mLower)) {
      category = 'Investments';
    }

    // 10. DUPLICATE CHECK AGAINST USER DATABASE
    let isDuplicate = false;
    let duplicateReason = null;

    if (referenceId) {
      const existingRef = await prisma.transaction.findFirst({
        where: {
          userId,
          notes: { contains: referenceId },
        },
      });
      if (existingRef) {
        isDuplicate = true;
        duplicateReason = `A transaction with reference ID ${referenceId} has already been imported.`;
      }
    }

    if (!isDuplicate) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existingRecent = await prisma.transaction.findFirst({
        where: {
          userId,
          amount,
          transactionType,
          merchant: { contains: merchant.slice(0, 10), mode: 'insensitive' },
          date: { gte: oneDayAgo },
        },
      });
      if (existingRecent) {
        isDuplicate = true;
        duplicateReason = `A matching ${transactionType.toLowerCase()} of ${formatINR(amount)} to "${merchant}" was recorded recently.`;
      }
    }

    let matchedAccount = null;
    if (accountSuffix) {
      matchedAccount = await prisma.financialAccount.findFirst({
        where: {
          userId,
          name: { contains: accountSuffix },
        },
      });
    }
    if (!matchedAccount && bankName) {
      matchedAccount = await prisma.financialAccount.findFirst({
        where: {
          userId,
          name: { contains: bankName.split(' ')[0], mode: 'insensitive' },
        },
      });
    }
    if (!matchedAccount) {
      matchedAccount = await prisma.financialAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    return {
      isValid: true,
      amount,
      formattedAmount: formatINR(amount),
      transactionType,
      bankName,
      accountSuffix,
      matchedAccountId: matchedAccount?.id || null,
      matchedAccountName: matchedAccount?.name || `${bankName} (Auto)`,
      referenceId,
      merchant,
      category,
      isDuplicate,
      duplicateReason,
      date: new Date().toISOString(),
      rawPreview: text.length > 120 ? text.slice(0, 120) + '...' : text,
    };
  }

  /**
   * Commits a confirmed SMS transaction to the user's database
   */
  async commitSmsTransaction(userId, payload) {
    const { amount, transactionType, accountId, category, merchant, referenceId, date, remarks } = payload;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Valid positive transaction amount is required.');
    }

    const type = transactionType === 'INCOME' ? 'INCOME' : 'EXPENSE';

    let account = null;
    if (accountId) {
      account = await prisma.financialAccount.findFirst({ where: { id: accountId, userId } });
    }
    if (!account) {
      account = await prisma.financialAccount.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } });
    }
    if (!account) {
      account = await prisma.financialAccount.create({
        data: { userId, name: 'Primary Bank Account', balance: 0, currency: 'INR' },
      });
    }

    const catName = category || 'Other';
    let categoryRecord = await prisma.category.findFirst({
      where: { userId, name: { equals: catName, mode: 'insensitive' } },
    });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: { userId, name: catName, categoryType: type },
      });
    }

    return await prisma.$transaction(async (tx) => {
      const noteText = [
        `SMS Import`,
        referenceId ? `Ref: ${referenceId}` : null,
        remarks ? `Remarks: ${remarks}` : null,
      ].filter(Boolean).join(' | ');

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: categoryRecord.id,
          amount: parsedAmount,
          transactionType: type,
          merchant: (merchant || 'Bank Transaction').trim(),
          description: `${type === 'INCOME' ? 'Received from' : 'Paid to'} ${(merchant || 'Bank Transaction').trim()}`,
          notes: noteText,
          paymentMethod: referenceId ? `UPI/Ref: ${referenceId}` : 'Bank SMS Alert',
          date: date ? new Date(date) : new Date(),
        },
      });

      if (type === 'INCOME') {
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { increment: parsedAmount } },
        });
      } else {
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: parsedAmount } },
        });
      }

      await tx.notification.create({
        data: {
          userId,
          title: `📩 Bank SMS Transaction Imported`,
          message: `Recorded ${type} of ${formatINR(parsedAmount)} into ${account.name} ("${merchant || 'Bank Transaction'}").`,
          type: 'SUCCESS',
          link: '/transactions.html',
        },
      });

      return transaction;
    });
  }
}

module.exports = new SmsTransactionService();
