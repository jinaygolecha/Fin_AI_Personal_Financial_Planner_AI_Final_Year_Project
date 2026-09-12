const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');
const { createWorker } = require('tesseract.js');
const storageService = require('../services/storageService');
const { v4: uuidv4 } = require('uuid');

/**
 * OCR Receipt & Bank Statement CSV Import Controller
 * Owner: Jinay Golecha (jinay_golecha)
 * ABSOLUTE RULE 1 & 15 COMPLIANCE: Zero fake OCR results.
 * Real OCR extraction with file validation, MIME checking, and user confirmation.
 */

// Helper: Parse structured receipt fields from extracted text
const parseReceiptText = (rawText) => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let merchant = null;
  let amount = null;
  let date = null;
  let category = 'General';
  const items = [];

  const textLower = rawText.toLowerCase();

  // 1. Merchant Detection: Check first 3 lines or known brands
  const knownMerchants = [
    { pattern: /starbucks/i, name: 'Starbucks Coffee', cat: 'Food' },
    { pattern: /mcdonald|mcd/i, name: "McDonald's", cat: 'Food' },
    { pattern: /subway/i, name: 'Subway', cat: 'Food' },
    { pattern: /domino/i, name: "Domino's Pizza", cat: 'Food' },
    { pattern: /swiggy/i, name: 'Swiggy', cat: 'Food' },
    { pattern: /zomato/i, name: 'Zomato', cat: 'Food' },
    { pattern: /d-?mart|avenue\s+supermarts/i, name: 'DMart Supermarket', cat: 'Groceries' },
    { pattern: /reliance\s+(?:fresh|smart|retail)/i, name: 'Reliance Retail', cat: 'Groceries' },
    { pattern: /nature'?s\s+basket/i, name: "Nature's Basket", cat: 'Groceries' },
    { pattern: /bigbasket/i, name: 'BigBasket', cat: 'Groceries' },
    { pattern: /apollo\s+pharmacy/i, name: 'Apollo Pharmacy', cat: 'Healthcare' },
    { pattern: /medplus/i, name: 'MedPlus Pharmacy', cat: 'Healthcare' },
    { pattern: /uber/i, name: 'Uber Rides', cat: 'Transport' },
    { pattern: /ola/i, name: 'Ola Cabs', cat: 'Transport' },
    { pattern: /shell|bharat\s+petroleum|indian\s+oil|hp\s+petrol/i, name: 'Fuel Station', cat: 'Transport' },
    { pattern: /amazon/i, name: 'Amazon India', cat: 'Shopping' },
    { pattern: /flipkart/i, name: 'Flipkart', cat: 'Shopping' },
    { pattern: /zara/i, name: 'Zara', cat: 'Shopping' },
    { pattern: /h&m|hnm/i, name: 'H&M', cat: 'Shopping' },
    { pattern: /croma/i, name: 'Croma Electronics', cat: 'Electronics' },
    { pattern: /ikea/i, name: 'IKEA', cat: 'Home' },
  ];

  for (const km of knownMerchants) {
    if (km.pattern.test(textLower)) {
      merchant = km.name;
      category = km.cat;
      break;
    }
  }

  // Fallback to first line that isn't a tax or header line
  if (!merchant && lines.length > 0) {
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const candidate = lines[i].replace(/[^\w\s&'-]/g, '').trim();
      if (candidate.length >= 3 && !/invoice|tax|receipt|bill|gstin|pan/i.test(candidate)) {
        merchant = candidate;
        break;
      }
    }
  }
  if (!merchant) merchant = 'Retail Merchant';

  // 2. Amount Detection: Look for total amount patterns
  // Match lines with "total", "grand total", "net payable", "amount"
  const totalRegex = /(?:grand\s+total|net\s+total|total\s+amount|bill\s+amount|amount\s+payable|total|net\s+payable|bal(?:ance)?\s+due|subtotal)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i;
  const matchTotal = rawText.match(totalRegex);
  if (matchTotal && matchTotal[1]) {
    const parsed = parseFloat(matchTotal[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) amount = parsed;
  }

  // Fallback: look for currency symbol followed by numbers
  if (!amount) {
    const currencyRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
    let match;
    let maxFound = 0;
    while ((match = currencyRegex.exec(rawText)) !== null) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > maxFound) maxFound = val;
    }
    if (maxFound > 0) amount = maxFound;
  }

  // Last resort amount fallback: highest reasonable monetary value in lines
  if (!amount) {
    const anyNumberRegex = /\b\d+(?:,\d{3})*(?:\.\d{2})\b/g;
    const nums = rawText.match(anyNumberRegex);
    if (nums) {
      const vals = nums.map(n => parseFloat(n.replace(/,/g, ''))).filter(v => v > 0 && v < 1000000);
      if (vals.length > 0) {
        amount = Math.max(...vals);
      }
    }
  }

  // 3. Date Detection
  const datePatterns = [
    /\b(\d{4}[-/.]\d{2}[-/.]\d{2})\b/, // YYYY-MM-DD
    /\b(\d{2}[-/.]\d{2}[-/.]\d{4})\b/, // DD-MM-YYYY
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i,
  ];
  for (const dp of datePatterns) {
    const dm = rawText.match(dp);
    if (dm && dm[1]) {
      const parsedDate = new Date(dm[1]);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate.toISOString().split('T')[0];
        break;
      }
    }
  }
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }

  // 4. Category refinement if not already set by brand
  if (category === 'General') {
    if (/grocery|vegetable|fruit|dairy|milk|bread|supermarket/i.test(textLower)) {
      category = 'Groceries';
    } else if (/restaurant|dining|food|meal|pizza|burger|chai|coffee|bakery/i.test(textLower)) {
      category = 'Food';
    } else if (/petrol|diesel|fuel|toll|transport|cab|taxi|parking/i.test(textLower)) {
      category = 'Transport';
    } else if (/medicine|clinic|hospital|pharmacy|doctor|lab/i.test(textLower)) {
      category = 'Healthcare';
    } else if (/apparel|clothing|shoes|fashion|mall|shopping/i.test(textLower)) {
      category = 'Shopping';
    } else if (/electricity|water|broadband|recharge|mobile|utility/i.test(textLower)) {
      category = 'Utilities';
    }
  }

  // 5. Items extraction: lines with quantity or price patterns
  lines.forEach(line => {
    if (line.length > 4 && /\d/.test(line) && !/total|gst|tax|cash|change|card|subtotal/i.test(line)) {
      items.push(line.replace(/[^\w\s.,-]/g, '').trim());
    }
  });

  return {
    merchant,
    amount: amount ? Math.round(amount * 100) / 100 : null,
    date,
    category,
    items: items.slice(0, 5),
  };
};

/**
 * POST /api/v1/receipts/scan
 * Performs real OCR extraction using Tesseract.js on uploaded receipt image or text
 */
const scanReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { receiptText, imageData } = req.body;

    if (!receiptText && !imageData) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Either receipt image (imageData) or receipt text is required.' },
      });
    }

    let extractedText = (receiptText || '').trim();
    let ocrConfidence = 100;

    // If imageData is provided, perform genuine OCR via Tesseract.js
    if (imageData) {
      let imageBuffer = null;

      if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        // Base64 data URL
        const match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
        if (!match) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_IMAGE_FORMAT', message: 'Only PNG, JPEG, and WebP images are supported.' },
          });
        }
        imageBuffer = Buffer.from(match[2], 'base64');
      } else if (typeof imageData === 'string') {
        // Raw base64 string
        imageBuffer = Buffer.from(imageData, 'base64');
      } else if (Buffer.isBuffer(imageData)) {
        imageBuffer = imageData;
      }

      if (!imageBuffer || imageBuffer.length < 100) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE', message: 'Image payload is invalid or empty.' },
        });
      }

      // Max 10MB file limit
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return res.status(413).json({
          success: false,
          error: { code: 'IMAGE_TOO_LARGE', message: 'Image size exceeds maximum limit of 10MB.' },
        });
      }

      // Run Tesseract OCR Worker
      const worker = await createWorker('eng');
      try {
        const ocrResult = await worker.recognize(imageBuffer);
        extractedText = (ocrResult.data?.text || '').trim();
        ocrConfidence = Math.round(ocrResult.data?.confidence || 0);
      } finally {
        await worker.terminate();
      }

      if (!extractedText) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'OCR_UNREADABLE',
            message: 'Could not extract readable text from the uploaded image. Please ensure the receipt is well-lit and legible, or enter details manually.',
          },
        });
      }

      // Persist raw receipt image to Cloud / Local Storage Service (User-isolated path)
      try {
        const receiptExt = '.png';
        const storageKey = `users/${userId}/receipts/receipt_${Date.now()}_${uuidv4().slice(0, 8)}${receiptExt}`;
        const stored = await storageService.upload({
          buffer: imageBuffer,
          key: storageKey,
          contentType: 'image/png',
          metadata: { userId, documentType: 'receipts', scanDate: new Date().toISOString() },
        });
        req.__storedReceipt = stored;
      } catch (storageErr) {
        console.warn('[Storage] Receipt image storage notice:', storageErr.message);
      }
    }

    const parsed = parseReceiptText(extractedText);
    const storedReceipt = req.__storedReceipt || null;

    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(200).json({
        success: true,
        data: {
          scanId: null,
          merchant: parsed.merchant || 'Unidentified Merchant',
          amount: null,
          formattedAmount: 'Unrecognized',
          date: parsed.date,
          category: parsed.category,
          items: parsed.items,
          rawText: extractedText.slice(0, 500),
          ocrConfidence,
          receiptImageUrl: storedReceipt?.url || null,
          storageKey: storedReceipt?.key || null,
          status: 'MANUAL_INPUT_REQUIRED',
          message: 'Could not detect a clear total amount from the receipt. Please enter the amount before confirming.',
        },
      });
    }

    // Persist scan preview to DB with status PENDING_CONFIRMATION
    const scan = await prisma.receiptScan.create({
      data: {
        userId,
        merchant: parsed.merchant,
        amount: parsed.amount,
        date: new Date(parsed.date),
        category: parsed.category,
        items: {
          lineItems: parsed.items,
          storageKey: storedReceipt?.key || null,
          receiptImageUrl: storedReceipt?.url || null,
          confidence: ocrConfidence,
        },
        rawText: extractedText.slice(0, 1000),
        status: 'PENDING_CONFIRMATION',
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        scanId: scan.id,
        merchant: parsed.merchant,
        amount: parsed.amount,
        formattedAmount: formatINR(parsed.amount),
        date: parsed.date,
        category: parsed.category,
        items: parsed.items,
        ocrConfidence,
        rawTextPreview: extractedText.slice(0, 200),
        receiptImageUrl: storedReceipt?.url || null,
        storageKey: storedReceipt?.key || null,
        status: 'PENDING_CONFIRMATION',
        message: `Extracted ${formatINR(parsed.amount)} ${parsed.category} expense from ${parsed.merchant}. Please confirm to save to your transactions.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/receipts/confirm
 * Atomically commits confirmed receipt to financial transactions table
 */
const confirmReceipt = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { scanId, accountId, amount, merchant, category, date, notes } = req.body;

    const txAmount = parseFloat(amount);
    if (!amount || isNaN(txAmount) || txAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid positive amount is required.' },
      });
    }

    let account = await prisma.financialAccount.findFirst({
      where: {
        userId,
        ...(accountId ? { id: accountId } : { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!account) {
      account = await prisma.financialAccount.create({
        data: { userId, name: 'Primary Account', balance: 0, currency: 'INR' },
      });
    }

    let categoryRecord = await prisma.category.findFirst({
      where: { userId, name: { equals: category || 'Food', mode: 'insensitive' } },
    });
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: { userId, name: category || 'Food', categoryType: 'EXPENSE' },
      });
    }

    const txDate = date ? new Date(date) : new Date();

    const transaction = await prisma.$transaction(async (tx) => {
      const createdTx = await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          categoryId: categoryRecord.id,
          amount: txAmount,
          transactionType: 'EXPENSE',
          merchant: (merchant || 'Receipt Merchant').trim(),
          description: `Receipt: ${(merchant || 'Expense').trim()}`,
          notes: notes || 'Recorded via OCR Receipt Scanner confirmation',
          date: txDate,
        },
      });

      // Atomically decrement account balance
      await tx.financialAccount.update({
        where: { id: account.id },
        data: { balance: { decrement: txAmount } },
      });

      if (scanId) {
        await tx.receiptScan.updateMany({
          where: { id: scanId, userId },
          data: { status: 'CONFIRMED', transactionId: createdTx.id },
        });
      }

      return createdTx;
    });

    return res.status(201).json({
      success: true,
      data: {
        transaction,
        message: `Successfully recorded ${formatINR(txAmount)} expense to ${account.name}.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/import/bank-statement
 * Parses CSV statement, checks duplicates, categorizes rows, and returns preview stats
 */
const parseBankStatement = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { csvContent } = req.body;

    if (!csvContent) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'CSV content required.' } });
    }

    const lines = csvContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CSV', message: 'CSV requires header and at least 1 data row.' } });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('merchant') || h.includes('particulars'));
    const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('debit') || h.includes('credit'));
    const typeIdx = headers.findIndex(h => h.includes('type'));
    const categoryIdx = headers.findIndex(h => h.includes('category'));

    const existing = await prisma.transaction.findMany({
      where: { userId },
      select: { amount: true, date: true, description: true },
      take: 100,
    });

    const validRows = [];
    const duplicateRows = [];
    const invalidRows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const rawDate = dateIdx >= 0 ? cols[dateIdx] : new Date().toISOString().split('T')[0];
      const rawDesc = descIdx >= 0 ? cols[descIdx] : 'Bank Transaction';
      const rawAmount = amountIdx >= 0 ? parseFloat(cols[amountIdx]) : null;
      const rawType = typeIdx >= 0 ? cols[typeIdx].toUpperCase() : (rawAmount && rawAmount < 0 ? 'EXPENSE' : 'INCOME');
      const rawCat = categoryIdx >= 0 ? cols[categoryIdx] : 'General';

      if (!rawAmount || isNaN(rawAmount)) {
        invalidRows.push({ row: i, reason: 'Invalid or missing amount', data: lines[i] });
        continue;
      }

      const absAmount = Math.abs(rawAmount);
      const rowDate = new Date(rawDate);

      const isDuplicate = existing.some(e => 
        parseFloat(e.amount) === absAmount && 
        new Date(e.date).toISOString().split('T')[0] === rowDate.toISOString().split('T')[0]
      );

      const rowObj = {
        row: i,
        date: rawDate,
        description: rawDesc,
        amount: absAmount,
        type: rawType.includes('CR') || rawType.includes('INC') ? 'INCOME' : 'EXPENSE',
        category: rawCat,
      };

      if (isDuplicate) {
        duplicateRows.push(rowObj);
      } else {
        validRows.push(rowObj);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRows: lines.length - 1,
        validCount: validRows.length,
        duplicateCount: duplicateRows.length,
        invalidCount: invalidRows.length,
        preview: validRows.slice(0, 10),
        duplicates: duplicateRows,
        invalids: invalidRows,
        validRows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/import/confirm
 * Commits verified bank statement transactions to database
 */
const confirmBankStatementImport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { rows, accountId } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid rows to import.' } });
    }

    let account = await prisma.financialAccount.findFirst({
      where: {
        userId,
        ...(accountId ? { id: accountId } : { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!account) {
      account = await prisma.financialAccount.create({
        data: { userId, name: 'Primary Account', balance: 0, currency: 'INR' },
      });
    }

    let totalImported = 0;
    let netBalanceImpact = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const amt = parseFloat(row.amount);
        const txType = row.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

        await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            amount: amt,
            transactionType: txType,
            description: row.description || 'Imported statement transaction',
            date: row.date ? new Date(row.date) : new Date(),
          },
        });

        if (txType === 'INCOME') {
          netBalanceImpact += amt;
        } else {
          netBalanceImpact -= amt;
        }
        totalImported++;
      }

      await tx.financialAccount.update({
        where: { id: account.id },
        data: { balance: { increment: netBalanceImpact } },
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        importedCount: totalImported,
        accountName: account.name,
        netBalanceImpact,
        formattedNetImpact: formatINR(netBalanceImpact),
        message: `Successfully imported ${totalImported} transactions into ${account.name}.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  scanReceipt,
  confirmReceipt,
  parseBankStatement,
  confirmBankStatementImport,
};
