const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

/**
 * Intelligent Voice Transaction Parser for Indian Financial Contexts
 * Handles:
 * - "Received 4,000 rupees in my SBI account from a customer."
 * - "Paid 850 rupees for groceries from my HDFC account."
 * - "Received 12,000 rupees from a customer in my SBI account."
 * - "Paid 2,500 rupees for electricity."
 * - "Transferred 5,000 rupees from SBI to HDFC."
 */
class VoiceTransactionService {
  /**
   * Parses natural speech text and extracts financial parameters
   */
  async parseVoiceTransaction(userId, speechText) {
    if (!speechText || typeof speechText !== 'string' || !speechText.trim()) {
      throw new Error('Valid speech transcript is required.');
    }

    const text = speechText.trim();
    const lower = text.toLowerCase();

    // 1. Amount Extraction
    // Matches: 4,000, 4000, 4000.50, ₹850, Rs 12000, 5k, etc.
    let amount = null;
    const directAmtMatch = lower.match(/(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rupees|rs\.?|inr)?/i);
    const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/i);

    if (kMatch) {
      amount = parseFloat(kMatch[1]) * 1000;
    } else if (directAmtMatch && directAmtMatch[1]) {
      const cleanAmt = directAmtMatch[1].replace(/,/g, '');
      const parsed = parseFloat(cleanAmt);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
      }
    }

    // Secondary scan for isolated numbers if first failed
    if (!amount) {
      const numMatch = lower.match(/\b([0-9,]{2,10}(?:\.[0-9]{1,2})?)\b/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[1].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) amount = parsed;
      }
    }

    // 2. Transaction Direction / Type
    let transactionType = 'EXPENSE';
    const isTransfer = /\b(transferred|transfer|move|moved|sent from|send from)\b/i.test(lower) && /\b(to|into)\b/i.test(lower);
    const isIncome = /\b(received|credited|deposit|deposited|got|earned|salary|customer|inflow|refund|cashback|client payment)\b/i.test(lower);

    if (isTransfer) {
      transactionType = 'TRANSFER';
    } else if (isIncome) {
      transactionType = 'INCOME';
    } else {
      transactionType = 'EXPENSE';
    }

    // 3. User Accounts Detection
    const accounts = await prisma.financialAccount.findMany({
      where: { userId },
      select: { id: true, name: true, accountType: true, balance: true },
    });

    let matchedAccount = null;
    let targetAccount = null;

    if (accounts.length > 0) {
      if (isTransfer) {
        // Look for "from <bank> to <bank>"
        const fromMatch = lower.match(/(?:from)\s+([a-z0-9\s]+?)(?:\s+to|\s+into|$)/i);
        const toMatch = lower.match(/(?:to|into)\s+([a-z0-9\s]+?)(?:\s+from|\s+for|\s*\.|$)/i);

        if (fromMatch) {
          const fromName = fromMatch[1].trim().toLowerCase();
          matchedAccount = accounts.find(a => a.name.toLowerCase().includes(fromName) || fromName.includes(a.name.toLowerCase().split(' ')[0])) || null;
        }
        if (toMatch) {
          const toName = toMatch[1].trim().toLowerCase();
          targetAccount = accounts.find(a => a.name.toLowerCase().includes(toName) || toName.includes(a.name.toLowerCase().split(' ')[0])) || null;
        }
      }

      // 1. Check for specific bank names or acronyms mentioned in text first
      if (!matchedAccount) {
        if (/\b(sbi|state\s*bank)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /sbi|state\s*bank/i.test(a.name)) || null;
        } else if (/\b(hdfc)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /hdfc/i.test(a.name)) || null;
        } else if (/\b(icici)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /icici/i.test(a.name)) || null;
        } else if (/\b(axis)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /axis/i.test(a.name)) || null;
        } else if (/\b(kotak)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /kotak/i.test(a.name)) || null;
        } else if (/\b(pnb|punjab\s*national)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /pnb|punjab/i.test(a.name)) || null;
        } else if (/\b(bob|bank\s*of\s*baroda)\b/i.test(lower)) {
          matchedAccount = accounts.find(a => /bob|baroda/i.test(a.name)) || null;
        }
      }

      // 2. Fallback to distinctive account tokens (filtering out generic stop words)
      if (!matchedAccount) {
        const stopWords = new Set(['account', 'bank', 'primary', 'savings', 'current', 'wallet', 'card', 'my', 'the']);
        for (const acc of accounts) {
          const accLower = acc.name.toLowerCase();
          const tokens = accLower.split(/[\s()_-]+/).filter(t => t.length >= 3 && !stopWords.has(t));
          if (tokens.some(token => lower.includes(token))) {
            matchedAccount = acc;
            break;
          }
        }
      }

      if (!matchedAccount && accounts.length > 0) {
        matchedAccount = accounts[0];
      }
    }

    // 4. Category Prediction from keywords
    let category = 'Other';
    if (transactionType === 'EXPENSE') {
      if (/grocer|dmart|supermarket|vegetable|fruit|milk|ration/i.test(lower)) {
        category = 'Food & Dining';
      } else if (/electricity|power|electric|current bill|msedcl|bescom|tneb|water|gas|utility|wifi|broadband|recharge/i.test(lower)) {
        category = 'Utilities';
      } else if (/petrol|fuel|diesel|cng|uber|ola|cab|auto|metro|train|flight|bus|transport/i.test(lower)) {
        category = 'Transportation';
      } else if (/swiggy|zomato|starbucks|restaurant|cafe|dinner|lunch|breakfast|food|mcdonald/i.test(lower)) {
        category = 'Food & Dining';
      } else if (/amazon|flipkart|myntra|zara|cloth|shopping|shoes/i.test(lower)) {
        category = 'Shopping';
      } else if (/doctor|medicine|pharmacy|hospital|health|apollo/i.test(lower)) {
        category = 'Healthcare';
      } else if (/rent|maintenance/i.test(lower)) {
        category = 'Housing & Rent';
      } else if (/movie|netflix|spotify|prime|entertainment/i.test(lower)) {
        category = 'Entertainment';
      } else {
        category = 'General Expense';
      }
    } else if (transactionType === 'INCOME') {
      if (/salary|payroll|stipend|wages/i.test(lower)) {
        category = 'Salary';
      } else if (/customer|client|freelance|consulting|project/i.test(lower)) {
        category = 'Business / Freelance';
      } else if (/refund|cashback|reward/i.test(lower)) {
        category = 'Refunds & Cashback';
      } else if (/interest|dividend|profit/i.test(lower)) {
        category = 'Investment Returns';
      } else {
        category = 'Income';
      }
    } else {
      category = 'Transfer';
    }

    // 5. Description and Remarks Extraction
    let description = 'Voice Transaction';
    let remarks = `Voice recorded: "${text}"`;

    if (lower.includes('customer')) {
      description = 'Customer payment';
      remarks = 'Customer payment received';
    } else if (lower.includes('grocer')) {
      description = 'Groceries';
      remarks = 'Groceries purchase';
    } else if (lower.includes('electric')) {
      description = 'Electricity bill';
      remarks = 'Electricity utility payment';
    } else if (isTransfer) {
      description = `Transfer ${matchedAccount ? matchedAccount.name : ''} to ${targetAccount ? targetAccount.name : ''}`.trim();
      remarks = 'Internal account transfer';
    } else {
      // Clean up common filler words
      description = text.replace(/^(?:received|paid|spent|add|record)\s*(?:rs\.?|inr|₹)?\s*\d+(?:\.\d+)?\s*(?:rupees)?/i, '')
        .replace(/(?:in|from|to|into)\s+(?:my\s+)?[a-z0-9\s]+(?:account)?/i, '')
        .trim();
      if (!description || description.length < 3) {
        description = `${category} ${transactionType === 'INCOME' ? 'Credit' : 'Expense'}`;
      }
    }

    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);

    // 6. Construct Human Confirmation Message
    const amtStr = amount ? formatINR(amount) : 'unspecified amount';
    let confirmationMessage = '';

    if (transactionType === 'TRANSFER') {
      const fromStr = matchedAccount ? matchedAccount.name : 'your account';
      const toStr = targetAccount ? targetAccount.name : 'destination account';
      confirmationMessage = `Do you want to transfer ${amtStr} from ${fromStr} to ${toStr}?`;
    } else if (transactionType === 'INCOME') {
      const accStr = matchedAccount ? ` into your ${matchedAccount.name}` : '';
      confirmationMessage = `Do you want to record an incoming payment of ${amtStr}${accStr} for "${description}"?`;
    } else {
      const accStr = matchedAccount ? ` from your ${matchedAccount.name}` : '';
      confirmationMessage = `Do you want to record an expense of ${amtStr}${accStr} for ${category} ("${description}")?`;
    }

    const payload = {
      amount: amount || 0,
      transactionType,
      category,
      description,
      remarks,
      accountId: matchedAccount ? matchedAccount.id : (accounts[0]?.id || null),
      matchedAccountId: matchedAccount ? matchedAccount.id : (accounts[0]?.id || null),
      accountName: matchedAccount ? matchedAccount.name : (accounts[0]?.name || 'Primary Account'),
      matchedAccountName: matchedAccount ? matchedAccount.name : (accounts[0]?.name || 'Primary Account'),
      targetAccountId: targetAccount ? targetAccount.id : null,
      targetAccountName: targetAccount ? targetAccount.name : null,
      date: new Date().toISOString().split('T')[0],
      isAmbiguous: !amount || !matchedAccount,
    };

    return {
      success: true,
      amount: payload.amount,
      transactionType: payload.transactionType,
      category: payload.category,
      description: payload.description,
      remarks: payload.remarks,
      matchedAccountId: payload.matchedAccountId,
      matchedAccountName: payload.matchedAccountName,
      confirmationMessage,
      pendingPayload: payload,
      data: {
        intent: transactionType === 'TRANSFER' ? 'VOICE_TRANSFER' : 'VOICE_TRANSACTION',
        speechTranscript: text,
        requiresConfirmation: true,
        confirmationMessage,
        pendingPayload: payload,
      },
    };
  }

  /**
   * Commits the verified voice transaction to the database atomically
   */
  async commitVoiceTransaction(userId, payload) {
    const { amount, transactionType, category, description, remarks, accountId, targetAccountId, date } = payload;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Valid transaction amount greater than zero is required.');
    }

    // Resolve Account
    let account = null;
    if (accountId) {
      account = await prisma.financialAccount.findFirst({
        where: { id: accountId, userId },
      });
    }
    if (!account) {
      account = await prisma.financialAccount.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
    }
    if (!account) {
      account = await prisma.financialAccount.create({
        data: { userId, name: 'Primary Account', balance: 0, currency: 'INR' },
      });
    }

    // Resolve Category
    const catName = category || (transactionType === 'INCOME' ? 'Income' : 'General');
    let categoryRecord = await prisma.category.findFirst({
      where: { userId, name: { equals: catName, mode: 'insensitive' } },
    });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          userId,
          name: catName,
          categoryType: transactionType === 'TRANSFER' ? 'EXPENSE' : transactionType,
        },
      });
    }

    // Perform atomic transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Create primary transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: categoryRecord.id,
          amount: parsedAmount,
          transactionType: transactionType === 'TRANSFER' ? 'EXPENSE' : transactionType,
          description: (description || 'Voice Recorded Transaction').trim(),
          merchant: (description || 'Voice Entry').trim(),
          notes: (remarks || 'Created via voice recognition').trim(),
          date: date ? new Date(date) : new Date(),
        },
      });

      // 2. Adjust account balances
      if (transactionType === 'INCOME') {
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { increment: parsedAmount } },
        });
      } else if (transactionType === 'EXPENSE') {
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: parsedAmount } },
        });
      } else if (transactionType === 'TRANSFER') {
        // Deduct from source
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { balance: { decrement: parsedAmount } },
        });

        // Credit target account if specified
        if (targetAccountId) {
          await tx.financialAccount.update({
            where: { id: targetAccountId },
            data: { balance: { increment: parsedAmount } },
          });

          // Mirror credit transaction
          await tx.transaction.create({
            data: {
              userId,
              accountId: targetAccountId,
              categoryId: categoryRecord.id,
              amount: parsedAmount,
              transactionType: 'INCOME',
              description: `Transfer from ${account.name}`,
              merchant: `Transfer from ${account.name}`,
              notes: (remarks || 'Internal transfer via voice').trim(),
              date: date ? new Date(date) : new Date(),
            },
          });
        }
      }

      // 3. Persist notification
      await tx.notification.create({
        data: {
          userId,
          title: '🎤 Voice Transaction Saved',
          message: `Successfully recorded ${transactionType} of ${formatINR(parsedAmount)} into ${account.name} ("${description}").`,
          type: 'SUCCESS',
        },
      });

      return transaction;
    });
  }
}

module.exports = new VoiceTransactionService();
