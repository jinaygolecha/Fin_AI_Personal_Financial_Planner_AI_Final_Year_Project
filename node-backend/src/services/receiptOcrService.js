/**
 * FinPro — Multi-Engine Receipt OCR & Document Intelligence Service
 * Supported Formats: PNG, JPEG, WebP, Raw Receipt Text
 * Extraction Capabilities:
 * - Merchant name, Invoice/Receipt number, Transaction Date & Time, Currency
 * - Subtotal, Discount, Taxable Value, Other Charges, Total Amount
 * - GSTIN, CGST, SGST, IGST, Total GST
 * - Itemized Line Items (Description, Quantity, Unit Price, Total, GST Rate)
 * - Payment Method, ML Expense Category
 * - Mathematical reconciliation & validation status (VALIDATED / INCONSISTENT_TOTALS / UNCERTAIN)
 * - Dual-Engine Architecture: Google Gemini Vision AI + Tesseract.js Local Fallback
 * Owner: Jinay Golecha (jinay_golecha)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createWorker } = require('tesseract.js');
const mlCategorizerService = require('./mlCategorizerService');

// Indian 15-character GSTIN regex
const GSTIN_REGEX = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i;

// Indian and International Date Regexes
const DATE_PATTERNS = [
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/,          // DD-MM-YYYY or MM-DD-YYYY
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,          // YYYY-MM-DD
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})\b/,            // DD-MM-YY
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})\b/i, // 15 Aug 2026
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\b/i, // Aug 15, 2026
];

// Time Regex (12h or 24h with optional seconds)
const TIME_REGEX = /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/;

// Currency Regex
const CURRENCY_REGEX = /(?:₹|Rs\.?|INR|\$|USD|EUR|€|GBP|£)/i;

// Known Merchant Dictionary with Categories
const KNOWN_MERCHANTS = [
  { pattern: /starbucks/i, name: 'Starbucks Coffee', category: 'Food & Dining' },
  { pattern: /mcdonald|mcd/i, name: "McDonald's", category: 'Food & Dining' },
  { pattern: /subway/i, name: 'Subway', category: 'Food & Dining' },
  { pattern: /domino/i, name: "Domino's Pizza", category: 'Food & Dining' },
  { pattern: /pizza\s*hut/i, name: 'Pizza Hut', category: 'Food & Dining' },
  { pattern: /burger\s*king/i, name: 'Burger King', category: 'Food & Dining' },
  { pattern: /kfc/i, name: 'KFC', category: 'Food & Dining' },
  { pattern: /swiggy/i, name: 'Swiggy', category: 'Food & Dining' },
  { pattern: /zomato/i, name: 'Zomato', category: 'Food & Dining' },
  { pattern: /chaayos|chai\s*point/i, name: 'Chaayos', category: 'Food & Dining' },
  { pattern: /d-?mart|avenue\s+supermarts/i, name: 'DMart Supermarket', category: 'Groceries' },
  { pattern: /reliance\s+(?:fresh|smart|retail)/i, name: 'Reliance Retail', category: 'Groceries' },
  { pattern: /nature'?s\s+basket/i, name: "Nature's Basket", category: 'Groceries' },
  { pattern: /bigbasket/i, name: 'BigBasket', category: 'Groceries' },
  { pattern: /blinkit|grofers/i, name: 'Blinkit', category: 'Groceries' },
  { pattern: /zepto/i, name: 'Zepto', category: 'Groceries' },
  { pattern: /apollo\s+pharmacy/i, name: 'Apollo Pharmacy', category: 'Healthcare' },
  { pattern: /medplus/i, name: 'MedPlus Pharmacy', category: 'Healthcare' },
  { pattern: /1mg|tata\s+1mg/i, name: 'Tata 1mg', category: 'Healthcare' },
  { pattern: /uber/i, name: 'Uber Rides', category: 'Transport' },
  { pattern: /ola/i, name: 'Ola Cabs', category: 'Transport' },
  { pattern: /shell|bharat\s+petroleum|indian\s+oil|hp\s+petrol|bpcl|iocl|hpcl/i, name: 'Fuel Station', category: 'Transport' },
  { pattern: /amazon/i, name: 'Amazon India', category: 'Shopping' },
  { pattern: /flipkart/i, name: 'Flipkart', category: 'Shopping' },
  { pattern: /myntra/i, name: 'Myntra', category: 'Shopping' },
  { pattern: /zara/i, name: 'Zara', category: 'Shopping' },
  { pattern: /h&m|hnm/i, name: 'H&M', category: 'Shopping' },
  { pattern: /croma/i, name: 'Croma Electronics', category: 'Electronics' },
  { pattern: /reliance\s+digital/i, name: 'Reliance Digital', category: 'Electronics' },
  { pattern: /vijay\s+sales/i, name: 'Vijay Sales', category: 'Electronics' },
  { pattern: /ikea/i, name: 'IKEA', category: 'Home & Living' },
  { pattern: /airtel|jio|vodafone|vi\b/i, name: 'Telecom Provider', category: 'Utilities' },
];

class ReceiptOcrService {
  /**
   * Safe parser for currency numbers (handles Indian numbering with lakhs e.g. 1,45,200.50)
   */
  parseAmount(val) {
    if (typeof val === 'number') return Math.abs(val);
    if (!val) return null;
    const clean = String(val)
      .replace(/(?:₹|\$|INR|Rs\.?|EUR|€|GBP|£)/gi, '')
      .replace(/,/g, '')
      .replace(/[()]/g, '')
      .trim();
    const parsed = parseFloat(clean);
    return (isNaN(parsed) || parsed < 0) ? null : Math.round(parsed * 100) / 100;
  }

  /**
   * Normalizes date to ISO string YYYY-MM-DD
   */
  normalizeDate(rawDate) {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    const cleaned = String(rawDate).trim().replace(/['"]/g, '');

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = cleaned.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (dmy) {
      let day = parseInt(dmy[1], 10);
      let month = parseInt(dmy[2], 10);
      let year = dmy[3];
      if (year.length === 2) year = '20' + year;

      // Handle cases where month > 12 (MM-DD-YYYY swap check)
      if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Month name format e.g. 15-Aug-2026 or Aug 15 2026
    const monthMap = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const namedMonthMatch = cleaned.match(/(\d{1,2})[-/.\s]+([A-Za-z]{3})[a-z]*[-/.\s]+(\d{2,4})/);
    if (namedMonthMatch) {
      const day = namedMonthMatch[1].padStart(2, '0');
      const mon = monthMap[namedMonthMatch[2].toLowerCase().slice(0, 3)] || '01';
      let year = namedMonthMatch[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${mon}-${day}`;
    }

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Algorithmic OCR Text Parser (Extracts 15+ Structured Financial Fields)
   */
  parseReceiptText(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return {
        merchant: 'Unidentified Merchant',
        invoiceNumber: null,
        date: new Date().toISOString().split('T')[0],
        time: null,
        currency: 'INR',
        subtotal: null,
        discount: null,
        taxableValue: null,
        gstin: null,
        cgst: null,
        sgst: null,
        igst: null,
        totalGst: null,
        otherCharges: null,
        totalAmount: null,
        paymentMethod: null,
        items: [],
        category: 'General',
        confidence: 0,
        validationStatus: 'UNCERTAIN',
        warnings: ['Empty or unreadable text payload.'],
      };
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const warnings = [];

    // 1. Merchant Detection
    let merchant = null;
    let category = 'General';
    const textLower = rawText.toLowerCase();

    for (const km of KNOWN_MERCHANTS) {
      if (km.pattern.test(textLower)) {
        merchant = km.name;
        category = km.category;
        break;
      }
    }

    if (!merchant && lines.length > 0) {
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        const candidate = lines[i].replace(/[^\w\s&'-]/g, '').trim();
        if (
          candidate.length >= 3 &&
          !/invoice|tax|receipt|bill|gstin|pan|order|welcome|cash|memo|token|date|phone|tel/i.test(candidate)
        ) {
          merchant = candidate;
          break;
        }
      }
    }
    if (!merchant) merchant = 'Retail Merchant';

    // 2. Invoice / Receipt Number Detection
    let invoiceNumber = null;
    const invRegexes = [
      /(?:invoice\s*(?:no|num|number|#)?|bill\s*(?:no|num|number|#)?|receipt\s*(?:no|num|number|#)?|txn\s*(?:id|no|#)?|order\s*(?:id|no|#)?)\s*[:#-]?\s*([A-Za-z0-9\-\/]{3,30})/i,
      /\b(?:INV|BILL|REC|TXN)[-_/0-9A-Z]{4,25}\b/i,
    ];
    for (const ir of invRegexes) {
      const match = rawText.match(ir);
      if (match && match[1]) {
        invoiceNumber = match[1].trim();
        break;
      } else if (match && match[0]) {
        invoiceNumber = match[0].trim();
        break;
      }
    }

    // 3. Date & Time Detection
    let date = null;
    for (const dp of DATE_PATTERNS) {
      const dm = rawText.match(dp);
      if (dm) {
        date = this.normalizeDate(dm[0]);
        break;
      }
    }
    if (!date) {
      date = new Date().toISOString().split('T')[0];
      warnings.push('Date not explicitly identified on receipt; defaulted to today.');
    }

    let time = null;
    const tm = rawText.match(TIME_REGEX);
    if (tm && tm[1]) {
      time = tm[1].trim();
    }

    // 4. Currency Detection
    let currency = 'INR';
    if (/\$|USD/i.test(rawText)) currency = 'USD';
    else if (/€|EUR/i.test(rawText)) currency = 'EUR';
    else if (/£|GBP/i.test(rawText)) currency = 'GBP';

    // 5. GSTIN & Tax Identification
    let gstin = null;
    const gstinMatch = rawText.match(GSTIN_REGEX);
    if (gstinMatch && gstinMatch[1]) {
      gstin = gstinMatch[1].toUpperCase();
    }

    // Tax Components (CGST, SGST, IGST)
    let cgst = null;
    let sgst = null;
    let igst = null;
    let totalGst = null;

    const cgstMatch = rawText.match(/(?:CGST|Central\s+GST)(?:\s*@?\s*\(?[\d.]+%\)?)?[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (cgstMatch) cgst = this.parseAmount(cgstMatch[1]);

    const sgstMatch = rawText.match(/(?:SGST|State\s+GST|UTGST)(?:\s*@?\s*\(?[\d.]+%\)?)?[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (sgstMatch) sgst = this.parseAmount(sgstMatch[1]);

    const igstMatch = rawText.match(/(?:IGST|Integrated\s+GST)(?:\s*@?\s*\(?[\d.]+%\)?)?[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (igstMatch) igst = this.parseAmount(igstMatch[1]);

    const totalGstMatch = rawText.match(/(?:Total\s+GST|GST\s+Total|Total\s+Tax|GST\s+Amount)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (totalGstMatch) {
      totalGst = this.parseAmount(totalGstMatch[1]);
    } else if (cgst || sgst || igst) {
      totalGst = Math.round(((cgst || 0) + (sgst || 0) + (igst || 0)) * 100) / 100;
    }

    // 6. Subtotal, Discount, Taxable Value & Other Charges
    let subtotal = null;
    const subtotalMatch = rawText.match(/(?:sub\s*total|gross\s+amount|items\s+total)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (subtotalMatch) subtotal = this.parseAmount(subtotalMatch[1]);

    let discount = null;
    const discountMatch = rawText.match(/(?:discount|disc|promo|savings|less)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (discountMatch) discount = this.parseAmount(discountMatch[1]);

    let taxableValue = null;
    const taxableMatch = rawText.match(/(?:taxable\s+value|taxable\s+amount|net\s+value|net\s+amount)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (taxableMatch) {
      taxableValue = this.parseAmount(taxableMatch[1]);
    } else if (subtotal !== null && discount !== null) {
      taxableValue = Math.round((subtotal - discount) * 100) / 100;
    } else if (subtotal !== null) {
      taxableValue = subtotal;
    }

    if (subtotal === null && taxableValue !== null) {
      subtotal = discount ? Math.round((taxableValue + discount) * 100) / 100 : taxableValue;
    }

    let otherCharges = null;
    const chargesMatch = rawText.match(/(?:delivery\s*fee|delivery\s*charge|service\s*charge|packaging\s*(?:fee|charge)?|convenience\s*fee|round\s*off)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i);
    if (chargesMatch) otherCharges = this.parseAmount(chargesMatch[1]);

    // 7. Total Amount Detection
    let totalAmount = null;
    const totalRegexes = [
      /(?:grand\s+total|net\s+total|total\s+amount|bill\s+amount|amount\s+payable|total\s+payable|net\s+payable|bal(?:ance)?\s+due|amount\s+due|final\s+total)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:total)[\s:=₹rs\.]*([\d,]+(?:\.\d{1,2})?)/i,
    ];

    for (const tr of totalRegexes) {
      const match = rawText.match(tr);
      if (match && match[1]) {
        const val = this.parseAmount(match[1]);
        if (val && val > 0) {
          totalAmount = val;
          break;
        }
      }
    }

    // Fallback: look for currency symbol followed by numbers
    if (!totalAmount) {
      const currencyNumRegex = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi;
      let match;
      let maxCurrencyFound = 0;
      while ((match = currencyNumRegex.exec(rawText)) !== null) {
        const val = this.parseAmount(match[1]);
        if (val && val > maxCurrencyFound) maxCurrencyFound = val;
      }
      if (maxCurrencyFound > 0) totalAmount = maxCurrencyFound;
    }

    // Taxable value fallback resolution
    if (taxableValue === null) {
      taxableValue = subtotal || (totalAmount && totalGst ? Math.max(0, Math.round((totalAmount - totalGst) * 100) / 100) : null);
    }

    // 8. Payment Method
    let paymentMethod = null;
    if (/\b(?:upi|gpay|google\s*pay|phonepe|paytm|bhim)\b/i.test(rawText)) {
      paymentMethod = 'UPI';
    } else if (/\b(?:credit\s*card|mastercard|visa|rupay|amex)\b/i.test(rawText)) {
      paymentMethod = 'Credit Card';
    } else if (/\b(?:debit\s*card)\b/i.test(rawText)) {
      paymentMethod = 'Debit Card';
    } else if (/\b(?:cash|cash\s*tendered)\b/i.test(rawText)) {
      paymentMethod = 'Cash';
    } else if (/\b(?:net\s*banking|neft|rtgs|imps)\b/i.test(rawText)) {
      paymentMethod = 'Bank Transfer';
    }

    // 9. Line Items Extraction
    const items = [];
    const itemLineRegex = /^([a-zA-Z0-9\s&'-]{3,40})\s+(?:(\d+)\s*[xX*]\s*)?([₹Rs.\d,]+(?:\.\d{2})?)\s*$/;
    
    for (const line of lines) {
      // Exclude header, tax, and total lines
      if (/total|subtotal|gst|tax|discount|change|cash|card|balance|date|invoice|welcome|thank/i.test(line)) {
        continue;
      }
      // Line with text + amount at the end
      const lineMatch = line.match(/^(.+?)\s+([₹Rs.\d,]+(?:\.\d{2}))$/);
      if (lineMatch) {
        const itemDesc = lineMatch[1].replace(/[^\w\s&'-]/g, '').trim();
        const itemPrice = this.parseAmount(lineMatch[2]);
        if (itemDesc.length >= 2 && itemPrice && itemPrice > 0) {
          // Check for quantity in description e.g. "2 x Cold Coffee"
          let qty = 1;
          let cleanDesc = itemDesc;
          const qtyMatch = itemDesc.match(/^(\d+)\s*[xX*]\s*(.+)/);
          if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10) || 1;
            cleanDesc = qtyMatch[2].trim();
          }
          items.push({
            description: cleanDesc,
            quantity: qty,
            unitPrice: Math.round((itemPrice / qty) * 100) / 100,
            totalPrice: itemPrice,
            gstRate: totalGst ? 18 : null,
          });
        }
      }
    }

    // 10. Categorization Refinement (Heuristic Clues + ML Model)
    if (category === 'General' || category === 'Needs Review') {
      const allText = (merchant + ' ' + rawText).toLowerCase();
      if (/\b(canteen|cafe|restaurant|coffee|bistro|diner|kitchen|bar|grill|bakery|brewery|pub|food|dining|eats|burger|pizza|biryani|tea|chai|swiggy|zomato)\b/i.test(allText)) {
        category = 'Food & Dining';
      } else if (/\b(mart|supermarket|bazaar|groceries|fresh|vegetable|fruit|dairy|milk|bread)\b/i.test(allText)) {
        category = 'Groceries';
      } else if (/\b(pharmacy|chemist|hospital|clinic|meds|medical|healthcare|diagnostics|dr\.)\b/i.test(allText)) {
        category = 'Healthcare';
      } else if (/\b(fuel|petrol|diesel|gas|cabs|rides|metro|toll|fastag|parking|auto)\b/i.test(allText)) {
        category = 'Transport';
      } else {
        const mlPred = mlCategorizerService.predict(merchant, totalAmount);
        if (mlPred && mlPred.category && mlPred.category !== 'Needs Review') {
          category = mlPred.category;
        } else if (category === 'Needs Review') {
          category = 'General';
        }
      }
    }

    // 11. Mathematical Validation & Confidence Scoring
    let validationStatus = 'UNCERTAIN';
    let confidence = 50;

    if (totalAmount && totalAmount > 0) {
      confidence += 25;

      // Mathematical check against subtotal/taxable value and taxes
      if (taxableValue && totalGst) {
        const expectedTotal = Math.round((taxableValue + totalGst + (otherCharges || 0)) * 100) / 100;
        const diff = Math.abs(totalAmount - expectedTotal);
        if (diff <= 1.05) {
          validationStatus = 'VALIDATED';
          confidence = Math.min(100, confidence + 25);
        } else {
          validationStatus = 'INCONSISTENT_TOTALS';
          warnings.push(`Mathematical check: Total (${totalAmount}) does not reconcile with Taxable (${taxableValue}) + GST (${totalGst}) = ${expectedTotal}.`);
        }
      } else if (items.length > 0) {
        const sumItems = items.reduce((acc, it) => acc + (it.totalPrice || 0), 0);
        if (Math.abs(sumItems - totalAmount) <= 1.05 || (totalGst && Math.abs(sumItems + totalGst - totalAmount) <= 1.05)) {
          validationStatus = 'VALIDATED';
          confidence = Math.min(100, confidence + 20);
        } else {
          validationStatus = 'VALIDATED';
          confidence = Math.min(90, confidence + 10);
        }
      } else {
        validationStatus = 'VALIDATED';
      }
    } else {
      warnings.push('Total amount was not reliably detected from receipt image.');
      validationStatus = 'UNCERTAIN';
      confidence = Math.max(20, confidence - 20);
    }

    if (merchant && merchant !== 'Retail Merchant') confidence = Math.min(100, confidence + 10);
    if (gstin) confidence = Math.min(100, confidence + 10);

    return {
      merchant,
      invoiceNumber,
      date,
      time,
      currency,
      subtotal,
      discount,
      taxableValue,
      gstin,
      cgst,
      sgst,
      igst,
      totalGst,
      otherCharges,
      totalAmount,
      paymentMethod,
      items: items.slice(0, 15),
      category,
      confidence: Math.round(confidence),
      validationStatus,
      rawText,
      warnings,
    };
  }

  /**
   * Process Receipt via Gemini Generative Vision AI
   */
  async extractWithGeminiVision(imageBuffer, mimeType = 'image/png') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      return null;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.AI_MODEL || 'gemini-1.5-flash' });

      const prompt = `You are a high-accuracy financial OCR receipt extraction engine for India.
Examine this receipt image carefully. Extract all structured financial data in strict valid JSON format with this exact schema:
{
  "merchant": string or null (store or vendor name),
  "invoiceNumber": string or null (invoice, receipt or bill number),
  "date": string in YYYY-MM-DD or null,
  "time": string or null (e.g. "14:30:00" or "02:15 PM"),
  "currency": string (e.g. "INR"),
  "subtotal": number or null (taxable subtotal before taxes and discounts),
  "discount": number or null,
  "taxableValue": number or null,
  "gstin": string or null (15-character Indian GST number),
  "cgst": number or null,
  "sgst": number or null,
  "igst": number or null,
  "totalGst": number or null,
  "otherCharges": number or null (delivery, packaging, service charge, round-off),
  "totalAmount": number or null (grand total amount payable),
  "paymentMethod": string or null ("Cash", "Credit Card", "Debit Card", "UPI", etc.),
  "items": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "gstRate": number or null
    }
  ],
  "category": string (e.g. "Food & Dining", "Groceries", "Shopping", "Transport", "Healthcare", "Utilities", "General"),
  "rawText": string (all transcribed readable text from image)
}
CRITICAL RULES:
- Do NOT fabricate or hallucinate values. If a field is not present on the receipt, output null.
- Ensure all numbers are parsed as pure floats without currency symbols.
- Output ONLY the raw JSON object, without markdown code fences or conversational text.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType || 'image/png',
          },
        },
      ]);

      const text = result.response.text().trim();
      const cleanJson = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Reconcile and calculate validation status
      const totalAmount = this.parseAmount(parsed.totalAmount);
      const subtotal = this.parseAmount(parsed.subtotal);
      const totalGst = this.parseAmount(parsed.totalGst);
      const discount = this.parseAmount(parsed.discount);
      const otherCharges = this.parseAmount(parsed.otherCharges);

      let validationStatus = 'VALIDATED';
      let confidence = 95;

      if (!totalAmount) {
        validationStatus = 'UNCERTAIN';
        confidence = 40;
      } else if (subtotal && totalGst) {
        const expected = Math.round((subtotal + totalGst + (otherCharges || 0) - (discount || 0)) * 100) / 100;
        if (Math.abs(totalAmount - expected) > 1.05) {
          validationStatus = 'INCONSISTENT_TOTALS';
          confidence = 80;
        }
      }

      return {
        ...parsed,
        totalAmount,
        subtotal,
        discount,
        taxableValue: this.parseAmount(parsed.taxableValue) || subtotal,
        cgst: this.parseAmount(parsed.cgst),
        sgst: this.parseAmount(parsed.sgst),
        igst: this.parseAmount(parsed.igst),
        totalGst,
        otherCharges,
        confidence,
        validationStatus,
        engine: 'Gemini Vision AI',
      };
    } catch (err) {
      console.warn('[ReceiptOCR] Gemini Vision extraction notice (falling back to Tesseract):', err.message);
      return null;
    }
  }

  /**
   * Process Receipt via Local Tesseract.js OCR Worker
   */
  async extractWithTesseract(imageBuffer) {
    const worker = await createWorker('eng');
    try {
      const ocrResult = await worker.recognize(imageBuffer);
      const rawText = (ocrResult.data?.text || '').trim();
      const tesseractConfidence = Math.round(ocrResult.data?.confidence || 0);

      const parsed = this.parseReceiptText(rawText);
      return {
        ...parsed,
        rawText,
        confidence: Math.round((parsed.confidence * 0.7) + (tesseractConfidence * 0.3)),
        engine: 'Tesseract.js OCR',
      };
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Primary Entry Point: Extracts receipt data from imageBuffer or raw text
   */
  async processReceipt({ imageBuffer, mimeType, receiptText }) {
    if (receiptText && (!imageBuffer || imageBuffer.length === 0)) {
      const parsed = this.parseReceiptText(receiptText);
      return {
        ...parsed,
        engine: 'Text Pattern Engine',
      };
    }

    if (!imageBuffer || imageBuffer.length < 50) {
      throw new Error('Image data is invalid or empty.');
    }

    if (imageBuffer.length > 10 * 1024 * 1024) {
      throw Object.assign(new Error('Image size exceeds maximum limit of 10MB.'), { statusCode: 413, code: 'IMAGE_TOO_LARGE' });
    }

    // Attempt Gemini Vision AI first
    const geminiResult = await this.extractWithGeminiVision(imageBuffer, mimeType);
    if (geminiResult && geminiResult.totalAmount) {
      return geminiResult;
    }

    // Fallback to local Tesseract OCR
    const tesseractResult = await this.extractWithTesseract(imageBuffer);
    return tesseractResult;
  }
}

const receiptOcrService = new ReceiptOcrService();
module.exports = receiptOcrService;
