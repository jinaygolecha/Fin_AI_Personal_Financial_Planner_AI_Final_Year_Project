/**
 * FinPro — Past 50-Days Data Seeder for User Jinay
 * Owner: Jinay Golecha (jinay_golecha)
 * Populates 50 days of active financial telemetry, transactions, budgets, goals,
 * investments, and OCR Scanned Receipts with GST details.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedJinay50Days() {
  console.log('🚀 Seeding user Jinay with past 50 days of financial data & OCR receipts...');

  const email = 'jinay@finpro.com';
  const username = 'jinay';
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Find or create Jinay User
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'jinay' },
        { email: 'jinay@finpro.com' },
        { email: 'jinay.demo@finpro.local' },
      ],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: 'jinay',
        email: 'jinay@finpro.com',
        password: hashedPassword,
        firstName: 'Jinay',
        lastName: 'Golecha',
        isActive: true,
        isPremium: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        country: 'India',
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: 'jinay@finpro.com',
        username: 'jinay',
        password: hashedPassword,
        firstName: 'Jinay',
        lastName: 'Golecha',
        isActive: true,
        isPremium: true,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        country: 'India',
      },
    });
  }

  console.log(`👤 User ready: ${user.username} (${user.email}, ID: ${user.id})`);

  // Also update user profile
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      bio: 'FinTech Lead & Full-Stack AI Engineer | FinPro Project Owner',
      occupation: 'Software Engineer',
    },
    create: {
      userId: user.id,
      bio: 'FinTech Lead & Full-Stack AI Engineer | FinPro Project Owner',
      occupation: 'Software Engineer',
    },
  });

  // 2. Financial Profile & Plan
  await prisma.financialProfile.upsert({
    where: { userId: user.id },
    update: {
      age: 23,
      city: 'Mumbai',
      monthlySalary: 125000,
      estimatedMonthlyExpenses: 42000,
      currentSavings: 280000,
      totalDebt: 342000,
      riskProfile: 'MODERATE',
      isOnboardingComplete: true,
    },
    create: {
      userId: user.id,
      age: 23,
      city: 'Mumbai',
      monthlySalary: 125000,
      estimatedMonthlyExpenses: 42000,
      currentSavings: 280000,
      totalDebt: 342000,
      riskProfile: 'MODERATE',
      isOnboardingComplete: true,
    },
  });

  await prisma.financialPlan.upsert({
    where: { userId: user.id },
    update: {
      income: 125000,
      expenses: 42000,
      savingsTarget: 25000,
      emergencyFundTarget: 250000,
      investmentTarget: 50000,
      financialHealthScore: 84,
      riskProfile: 'Moderate',
      budgetMethod: '50/30/20',
      planSummary: 'Active 50/30/20 wealth allocation with equity index SIPs, precious metals, and disciplined debt retirement.',
    },
    create: {
      userId: user.id,
      income: 125000,
      expenses: 42000,
      savingsTarget: 25000,
      emergencyFundTarget: 250000,
      investmentTarget: 50000,
      financialHealthScore: 84,
      riskProfile: 'Moderate',
      budgetMethod: '50/30/20',
      planSummary: 'Active 50/30/20 wealth allocation with equity index SIPs, precious metals, and disciplined debt retirement.',
    },
  });

  // 3. Accounts
  let salaryAcc = await prisma.financialAccount.findFirst({
    where: { userId: user.id, name: 'HDFC Premium Salary Account' },
  });
  if (!salaryAcc) {
    salaryAcc = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: 'HDFC Premium Salary Account',
        accountType: 'SAVINGS',
        accountNumberMasked: '•••• 4589',
        balance: 168400,
        currency: 'INR',
      },
    });
  } else {
    await prisma.financialAccount.update({
      where: { id: salaryAcc.id },
      data: { balance: 168400 },
    });
  }

  let emergencyAcc = await prisma.financialAccount.findFirst({
    where: { userId: user.id, name: 'ICICI Emergency Reserve' },
  });
  if (!emergencyAcc) {
    emergencyAcc = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: 'ICICI Emergency Reserve',
        accountType: 'SAVINGS',
        accountNumberMasked: '•••• 7120',
        balance: 85000,
        currency: 'INR',
      },
    });
  }

  let tradingAcc = await prisma.financialAccount.findFirst({
    where: { userId: user.id, name: 'Zerodha Trading & Demat' },
  });
  if (!tradingAcc) {
    tradingAcc = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: 'Zerodha Trading & Demat',
        accountType: 'OTHER',
        accountNumberMasked: '•••• ZR99',
        balance: 45000,
        currency: 'INR',
      },
    });
  }

  // 4. Categories
  const categoriesList = [
    { name: 'Food', type: 'EXPENSE' },
    { name: 'Groceries', type: 'EXPENSE' },
    { name: 'Transport', type: 'EXPENSE' },
    { name: 'Shopping', type: 'EXPENSE' },
    { name: 'Utilities', type: 'EXPENSE' },
    { name: 'Healthcare', type: 'EXPENSE' },
    { name: 'Housing', type: 'EXPENSE' },
    { name: 'Entertainment', type: 'EXPENSE' },
    { name: 'Investment', type: 'EXPENSE' },
    { name: 'Salary', type: 'INCOME' },
    { name: 'Freelance', type: 'INCOME' },
  ];

  const catMap = {};
  for (const c of categoriesList) {
    let rec = await prisma.category.findFirst({
      where: { userId: user.id, name: { equals: c.name, mode: 'insensitive' } },
    });
    if (!rec) {
      rec = await prisma.category.create({
        data: { userId: user.id, name: c.name, categoryType: c.type },
      });
    }
    catMap[c.name] = rec.id;
  }

  // 5. Clean up old user records so we have a clean 50-day dataset
  await prisma.receiptScan.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });

  // 6. Generate 50-Day Timeline
  // Today is Oct 16, 2026. 50 days ago is Aug 27, 2026.
  const today = new Date('2026-10-16T12:00:00Z');

  // Pre-planned transactions and OCR Receipts across 50 days
  const transactionData = [
    // --- Late August (Aug 27 - Aug 31) ---
    { daysAgo: 49, date: '2026-08-28', desc: 'Shell Petrol Fuel Refill', amt: 2200, type: 'EXPENSE', cat: 'Transport', merchant: 'Shell Petrol Station', receipt: true },
    { daysAgo: 48, date: '2026-08-29', desc: 'Nature Basket Organic Groceries', amt: 3450, type: 'EXPENSE', cat: 'Groceries', merchant: "Nature's Basket", receipt: true },
    { daysAgo: 46, date: '2026-08-31', desc: 'Swiggy Gourmet Dinner', amt: 680, type: 'EXPENSE', cat: 'Food', merchant: 'Swiggy' },

    // --- September (Sep 01 - Sep 30) ---
    { daysAgo: 45, date: '2026-09-01', desc: 'Monthly Salary Credit', amt: 125000, type: 'INCOME', cat: 'Salary', merchant: 'Employer Direct Deposit' },
    { daysAgo: 44, date: '2026-09-02', desc: 'Apartment Monthly Rent', amt: 24000, type: 'EXPENSE', cat: 'Housing', merchant: 'Landlord Transfer' },
    { daysAgo: 43, date: '2026-09-03', desc: 'Reliance Smart Supermarket', amt: 4800, type: 'EXPENSE', cat: 'Groceries', merchant: 'Reliance Retail', receipt: true },
    { daysAgo: 42, date: '2026-09-04', desc: 'Starbucks Coffee & Snacks', amt: 540, type: 'EXPENSE', cat: 'Food', merchant: 'Starbucks Coffee', receipt: true },
    { daysAgo: 40, date: '2026-09-06', desc: 'Uber Premium City Commute', amt: 420, type: 'EXPENSE', cat: 'Transport', merchant: 'Uber Rides' },
    { daysAgo: 38, date: '2026-09-08', desc: 'Apollo Pharmacy Health & Medicines', amt: 1250, type: 'EXPENSE', cat: 'Healthcare', merchant: 'Apollo Pharmacy', receipt: true },
    { daysAgo: 36, date: '2026-09-10', desc: 'Nifty 50 Index Fund Monthly SIP', amt: 15000, type: 'EXPENSE', cat: 'Investment', merchant: 'NSE Nifty Index Fund' },
    { daysAgo: 34, date: '2026-09-12', desc: 'DMart Supermarket Monthly Restock', amt: 6850, type: 'EXPENSE', cat: 'Groceries', merchant: 'DMart Supermarket', receipt: true },
    { daysAgo: 32, date: '2026-09-14', desc: 'Tata Power Electricity Bill', amt: 3150, type: 'EXPENSE', cat: 'Utilities', merchant: 'Tata Power' },
    { daysAgo: 31, date: '2026-09-15', desc: 'Amazon India Tech Accessories', amt: 4200, type: 'EXPENSE', cat: 'Shopping', merchant: 'Amazon India', receipt: true },
    { daysAgo: 29, date: '2026-09-17', desc: 'Zomato Dining & Cafe', amt: 1120, type: 'EXPENSE', cat: 'Food', merchant: 'Zomato' },
    { daysAgo: 27, date: '2026-09-19', desc: 'Bharat Petroleum Fuel', amt: 2500, type: 'EXPENSE', cat: 'Transport', merchant: 'Fuel Station', receipt: true },
    { daysAgo: 26, date: '2026-09-20', desc: 'Parag Parikh Flexi Cap SIP', amt: 10000, type: 'EXPENSE', cat: 'Investment', merchant: 'PPFAS Mutual Fund' },
    { daysAgo: 24, date: '2026-09-22', desc: 'Zara Autumn Clothing Purchase', amt: 5400, type: 'EXPENSE', cat: 'Shopping', merchant: 'Zara', receipt: true },
    { daysAgo: 21, date: '2026-09-25', desc: 'HDFC Car Loan Monthly EMI', amt: 8900, type: 'EXPENSE', cat: 'Housing', merchant: 'HDFC Auto Finance' },
    { daysAgo: 19, date: '2026-09-27', desc: 'Croma Electronics Wireless Charger & Cables', amt: 3800, type: 'EXPENSE', cat: 'Shopping', merchant: 'Croma Electronics', receipt: true },
    { daysAgo: 17, date: '2026-09-29', desc: 'Domino Pizza Team Dinner', amt: 890, type: 'EXPENSE', cat: 'Food', merchant: "Domino's Pizza", receipt: true },
    { daysAgo: 16, date: '2026-09-30', desc: 'Freelance AI Consulting Retainer', amt: 35000, type: 'INCOME', cat: 'Freelance', merchant: 'FinTech AI Advisory' },

    // --- October (Oct 01 - Oct 16) ---
    { daysAgo: 15, date: '2026-10-01', desc: 'Monthly Salary Credit', amt: 125000, type: 'INCOME', cat: 'Salary', merchant: 'Employer Direct Deposit' },
    { daysAgo: 14, date: '2026-10-02', desc: 'Apartment Monthly Rent', amt: 24000, type: 'EXPENSE', cat: 'Housing', merchant: 'Landlord Transfer' },
    { daysAgo: 13, date: '2026-10-03', desc: 'Nature Basket Gourmet Pantry', amt: 4100, type: 'EXPENSE', cat: 'Groceries', merchant: "Nature's Basket", receipt: true },
    { daysAgo: 11, date: '2026-10-05', desc: 'Starbucks Coffee Meeting', amt: 480, type: 'EXPENSE', cat: 'Food', merchant: 'Starbucks Coffee', receipt: true },
    { daysAgo: 9, date: '2026-10-07', desc: 'Uber Airport Ride', amt: 580, type: 'EXPENSE', cat: 'Transport', merchant: 'Uber Rides' },
    { daysAgo: 7, date: '2026-10-09', desc: 'Nifty 50 Index Fund Monthly SIP', amt: 15000, type: 'EXPENSE', cat: 'Investment', merchant: 'NSE Nifty Index Fund' },
    { daysAgo: 6, date: '2026-10-10', desc: 'DMart Provisions Restock', amt: 5900, type: 'EXPENSE', cat: 'Groceries', merchant: 'DMart Supermarket', receipt: true },
    { daysAgo: 4, date: '2026-10-12', desc: 'Apollo Pharmacy Health Supplements', amt: 920, type: 'EXPENSE', cat: 'Healthcare', merchant: 'Apollo Pharmacy', receipt: true },
    { daysAgo: 2, date: '2026-10-14', desc: 'Amazon Technical Reference Books', amt: 2650, type: 'EXPENSE', cat: 'Shopping', merchant: 'Amazon India', receipt: true },
    { daysAgo: 1, date: '2026-10-15', desc: 'Starbucks Coffee & Sandwich', amt: 390, type: 'EXPENSE', cat: 'Food', merchant: 'Starbucks Coffee', receipt: true },
    { daysAgo: 0, date: '2026-10-16', desc: 'Fresh Dairy & Kitchen Essentials', amt: 720, type: 'EXPENSE', cat: 'Groceries', merchant: 'Reliance Retail' },
  ];

  // Map of receipt data templates for realistic OCR extraction
  const receiptTemplates = {
    'Shell Petrol Station': {
      gstin: '27AAACS4321E1Z8',
      taxRate: 0.18,
      items: ['Shell V-Power Petrol 21.36L @ 102.99', 'Windshield Washer Fluid'],
      raw: (d, amt) => `SHELL PETROL STATION #402\nS.V. Road, Bandra West, Mumbai 400050\nGSTIN: 27AAACS4321E1Z8\nDate: ${d}\nReceipt #: SH-${Math.floor(100000 + Math.random()*900000)}\n--------------------------------\nShell V-Power Petrol: Rs ${(amt * 0.9).toFixed(2)}\nWindshield Fluid: Rs ${(amt * 0.1).toFixed(2)}\n--------------------------------\nSubtotal: Rs ${(amt / 1.18).toFixed(2)}\nCGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nSGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nPayment: HDFC Card ending 4291`,
    },
    "Nature's Basket": {
      gstin: '27AABCN8899M1ZT',
      taxRate: 0.05,
      items: ['Artisan Sourdough Loaf', 'Greek Yogurt 400g', 'Organic Haas Avocado 2pk', 'Imported Berry Blend'],
      raw: (d, amt) => `NATURE'S BASKET LIMITED\nBandra West Store, Mumbai\nGSTIN: 27AABCN8899M1ZT\nDate: ${d}\nTAX INVOICE / CASH MEMO\n--------------------------------\nArtisan Sourdough: Rs 280.00\nGreek Yogurt: Rs 350.00\nAvocado 2pk: Rs 490.00\nGrocery Provisions: Rs ${(amt - 1120).toFixed(2)}\n--------------------------------\nNet Total: Rs ${(amt / 1.05).toFixed(2)}\nCGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nSGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nGrand Total: Rs ${amt.toFixed(2)}\nCard: Verified Approved`,
    },
    'Reliance Retail': {
      gstin: '27AABCR2345D1ZV',
      taxRate: 0.05,
      items: ['Aashirvaad Multigrain Atta 5kg', 'Fortune Sunflower Oil 2L', 'Tata Salt 1kg', 'Amul Butter 500g'],
      raw: (d, amt) => `RELIANCE SMART BAZAAR\nStore #502, Linking Road, Mumbai\nGSTIN: 27AABCR2345D1ZV\nDate: ${d}\n--------------------------------\nAashirvaad Atta 5kg: Rs 340.00\nFortune Oil 2L: Rs 380.00\nDairy & Provisions: Rs ${(amt - 720).toFixed(2)}\n--------------------------------\nTotal Amount: Rs ${amt.toFixed(2)}\nCGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nSGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nMode: UPI Payment Success`,
    },
    'Starbucks Coffee': {
      gstin: '27AACCS1234F1Z5',
      taxRate: 0.05,
      items: ['Caffe Latte Grande', 'Butter Croissant', 'Signature Chocolate Cookie'],
      raw: (d, amt) => `STARBUCKS COFFEE INDIA\nBandra Reclamation, Mumbai 400050\nGSTIN: 27AACCS1234F1Z5\nDate: ${d}\nOrder # 1422 — Dine In\n--------------------------------\nCaffe Latte Grande: Rs 350.00\nButter Croissant: Rs ${(amt - 350).toFixed(2)}\n--------------------------------\nTaxable Amount: Rs ${(amt / 1.05).toFixed(2)}\nCGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nSGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nPayment: Contactless Card`,
    },
    'Apollo Pharmacy': {
      gstin: '27AAPCA5566K1ZG',
      taxRate: 0.12,
      items: ['Becosules Z Multivitamins 30s', 'Dolo 650mg 15s', 'Antiseptic Solution 250ml', 'First Aid Care Kit'],
      raw: (d, amt) => `APOLLO PHARMACY LTD\nRetail Branch #1209, Hill Road, Mumbai\nGSTIN: 27AAPCA5566K1ZG\nDate: ${d}\nRETAIL DRUG INVOICE\n--------------------------------\nBecosules Z: Rs 180.00\nDolo 650mg: Rs 65.00\nHealthcare Supplies: Rs ${(amt - 245).toFixed(2)}\n--------------------------------\nNet Taxable: Rs ${(amt / 1.12).toFixed(2)}\nCGST 6%: Rs ${(amt * 0.06 / 1.12).toFixed(2)}\nSGST 6%: Rs ${(amt * 0.06 / 1.12).toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nPayment: Paid Cash/Card`,
    },
    'DMart Supermarket': {
      gstin: '27AABCD3322F1ZK',
      taxRate: 0.05,
      items: ['Basmati Rice 5kg', 'Toor Dal Premium 2kg', 'Detergent Powder 4kg', 'Handwash Refill 1L'],
      raw: (d, amt) => `AVENUE SUPERMARTS LTD (DMART)\nMalad West Branch, Mumbai\nGSTIN: 27AABCD3322F1ZK\nDate: ${d}\nCASH MEMO / TAX BILL\n--------------------------------\nBasmati Rice 5kg: Rs 620.00\nToor Dal 2kg: Rs 340.00\nHousehold & Groceries: Rs ${(amt - 960).toFixed(2)}\n--------------------------------\nTotal Bill Amount: Rs ${amt.toFixed(2)}\nCGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nSGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nPayment: HDFC Debit Card`,
    },
    'Amazon India': {
      gstin: '27AABCA0011C1ZX',
      taxRate: 0.18,
      items: ['Logitech Ergonomic Mouse', 'USB-C Thunderbolt Cable', 'Desk Cable Organizer'],
      raw: (d, amt) => `AMAZON RETAIL INDIA PRIVATE LIMITED\nFulfillment Center BOM4, Bhiwandi\nGSTIN: 27AABCA0011C1ZX\nInvoice Date: ${d}\nOrder #: 403-9182391-2391024\n--------------------------------\nComputer Peripherals: Rs ${(amt / 1.18).toFixed(2)}\n--------------------------------\nCGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nSGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nGrand Total: Rs ${amt.toFixed(2)}\nPayment Method: Net Banking Pre-paid`,
    },
    'Fuel Station': {
      gstin: '27AABCB9900H1ZB',
      taxRate: 0.18,
      items: ['Speed Petrol 24.5L @ 102.04'],
      raw: (d, amt) => `BHARAT PETROLEUM DEALER\nWestern Express Highway, Andheri\nGSTIN: 27AABCB9900H1ZB\nDate: ${d}\n--------------------------------\nSpeed Petrol: Rs ${amt.toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nCGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nSGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nPayment: POS Terminal Success`,
    },
    'Zara': {
      gstin: '27AABCI4433P1ZE',
      taxRate: 0.12,
      items: ['Cotton Oxford Shirt', 'Slim Fit Chinos'],
      raw: (d, amt) => `ITX TRADING INDIA (ZARA)\nHigh Street Phoenix, Lower Parel, Mumbai\nGSTIN: 27AABCI4433P1ZE\nDate: ${d}\nTAX INVOICE\n--------------------------------\nCotton Shirt: Rs 2790.00\nSlim Chinos: Rs ${(amt - 2790).toFixed(2)}\n--------------------------------\nTaxable: Rs ${(amt / 1.12).toFixed(2)}\nCGST 6%: Rs ${(amt * 0.06 / 1.12).toFixed(2)}\nSGST 6%: Rs ${(amt * 0.06 / 1.12).toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nCard: Verified Pin Approved`,
    },
    'Croma Electronics': {
      gstin: '27AAACI1122Q1ZW',
      taxRate: 0.18,
      items: ['MagSafe Wireless Charger 15W', 'Braided Cable 2M'],
      raw: (d, amt) => `INFINITI RETAIL LIMITED (CROMA)\nJuhu Branch, Mumbai 400049\nGSTIN: 27AAACI1122Q1ZW\nDate: ${d}\nTAX INVOICE / BILL OF SUPPLY\n--------------------------------\nMagSafe Charger: Rs 2999.00\nBraided Cable: Rs ${(amt - 2999).toFixed(2)}\n--------------------------------\nTaxable: Rs ${(amt / 1.18).toFixed(2)}\nCGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nSGST 9%: Rs ${(amt * 0.09 / 1.18).toFixed(2)}\nTotal Amount: Rs ${amt.toFixed(2)}\nMode: Credit Card Payment`,
    },
    "Domino's Pizza": {
      gstin: '27AABCJ7766R1ZT',
      taxRate: 0.05,
      items: ['Peppy Paneer Medium', 'Garlic Breadsticks', 'Pepsi 500ml'],
      raw: (d, amt) => `JUBILANT FOODWORKS LTD (DOMINOS)\nBandra West, Mumbai\nGSTIN: 27AABCJ7766R1ZT\nDate: ${d}\nOrder # 88\n--------------------------------\nPeppy Paneer: Rs 550.00\nBreadsticks: Rs 160.00\nPepsi: Rs ${(amt - 710).toFixed(2)}\n--------------------------------\nTotal Amount: Rs ${amt.toFixed(2)}\nCGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nSGST 2.5%: Rs ${(amt * 0.025 / 1.05).toFixed(2)}\nStatus: Delivered & Paid`,
    },
  };

  // Insert transactions and corresponding receipt scans
  let txCount = 0;
  let receiptCount = 0;

  for (const item of transactionData) {
    const txDate = new Date(item.date + 'T14:30:00Z');
    const createdTx = await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: salaryAcc.id,
        categoryId: catMap[item.cat] || catMap['Shopping'],
        amount: item.amt,
        transactionType: item.type,
        merchant: item.merchant,
        description: item.desc,
        notes: item.receipt ? `Recorded via OCR Receipt Scanner confirmation from ${item.merchant}` : 'Standard bank transaction',
        date: txDate,
      },
    });
    txCount++;

    if (item.receipt && receiptTemplates[item.merchant]) {
      const tmpl = receiptTemplates[item.merchant];
      const rawText = tmpl.raw(item.date, item.amt);
      const taxRate = tmpl.taxRate;
      const taxable = Math.round((item.amt / (1 + taxRate)) * 100) / 100;
      const totalTax = Math.round((item.amt - taxable) * 100) / 100;
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax / 2) * 100) / 100;

      const gstObj = {
        detected: true,
        gstin: tmpl.gstin,
        cgst,
        sgst,
        igst: null,
        totalGst: totalTax,
        stateCode: '27',
      };

      const gstBreakdown = {
        hasGst: true,
        gstin: tmpl.gstin,
        cgst,
        sgst,
        igst: null,
        totalGst: totalTax,
        taxableAmount: taxable,
      };

      await prisma.receiptScan.create({
        data: {
          userId: user.id,
          merchant: item.merchant,
          amount: item.amt,
          date: txDate,
          category: item.cat,
          items: {
            lineItems: tmpl.items,
            gst: gstObj,
            gstBreakdown,
            confidence: 96,
            verified: true,
          },
          rawText,
          status: 'CONFIRMED',
          transactionId: createdTx.id,
          createdAt: txDate,
        },
      });
      receiptCount++;
    }
  }

  // 7. Add 2 Recent Unconfirmed / Pending Review Receipts (Scanned Yesterday and Today)
  const pendingScans = [
    {
      merchant: 'Starbucks Coffee',
      amount: 450,
      date: new Date('2026-10-15T09:15:00Z'),
      category: 'Food',
      items: ['Cold Brew Grande', 'Blueberry Muffin'],
      gstin: '27AACCS1234F1Z5',
      rawText: 'STARBUCKS COFFEE INDIA\nBandra reclamation, Mumbai\nGSTIN: 27AACCS1234F1Z5\nDate: 2026-10-15\nCold Brew Grande: Rs 280.00\nBlueberry Muffin: Rs 170.00\nTotal Amount: Rs 450.00',
    },
    {
      merchant: 'DMart Supermarket',
      amount: 1850,
      date: new Date('2026-10-16T11:45:00Z'),
      category: 'Groceries',
      items: ['Fortune Rice Bran Oil 1L', 'Colgate Total 200g', 'Surf Excel 2kg', 'Dry Fruits 500g'],
      gstin: '27AABCD3322F1ZK',
      rawText: 'DMART SUPERMARKET\nMalad West, Mumbai\nGSTIN: 27AABCD3322F1ZK\nDate: 2026-10-16\nGrocery Restock Items\nTotal Amount: Rs 1850.00\nTaxable: Rs 1761.90\nCGST: Rs 44.05\nSGST: Rs 44.05',
    },
  ];

  for (const ps of pendingScans) {
    await prisma.receiptScan.create({
      data: {
        userId: user.id,
        merchant: ps.merchant,
        amount: ps.amount,
        date: ps.date,
        category: ps.category,
        items: {
          lineItems: ps.items,
          gst: {
            detected: true,
            gstin: ps.gstin,
            cgst: 44.05,
            sgst: 44.05,
            totalGst: 88.1,
            stateCode: '27',
          },
          gstBreakdown: {
            hasGst: true,
            gstin: ps.gstin,
            cgst: 44.05,
            sgst: 44.05,
            totalGst: 88.1,
            taxableAmount: ps.amount - 88.1,
          },
          confidence: 97,
        },
        rawText: ps.rawText,
        status: 'PENDING_CONFIRMATION',
        createdAt: ps.date,
      },
    });
    receiptCount++;
  }

  // 8. Monthly Budgets
  const curMonth = 10;
  const curYear = 2026;
  await prisma.budget.deleteMany({ where: { userId: user.id } });

  const budgets = [
    { cat: 'Food', limit: 12000, spent: 3480 },
    { cat: 'Groceries', limit: 15000, spent: 10720 },
    { cat: 'Transport', limit: 8000, spent: 3080 },
    { cat: 'Shopping', limit: 10000, spent: 2650 },
    { cat: 'Utilities', limit: 6000, spent: 0 },
    { cat: 'Healthcare', limit: 5000, spent: 920 },
    { cat: 'Housing', limit: 35000, spent: 24000 },
  ];

  for (const b of budgets) {
    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryName: b.cat,
        categoryId: catMap[b.cat] || null,
        monthlyLimit: b.limit,
        month: curMonth,
        year: curYear,
      },
    });
  }

  // 9. Goals
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        name: 'Emergency Fund (6 Months)',
        goalType: 'EMERGENCY_FUND',
        targetAmount: 250000,
        currentAmount: 185000,
        monthlyContribution: 15000,
        targetDate: new Date('2027-02-28'),
        status: 'ACTIVE',
      },
      {
        userId: user.id,
        name: 'New MacBook Pro M4 Max',
        goalType: 'OTHER',
        targetAmount: 160000,
        currentAmount: 130000,
        monthlyContribution: 10000,
        targetDate: new Date('2026-12-31'),
        status: 'ACTIVE',
      },
      {
        userId: user.id,
        name: 'Europe Summer Tour 2027',
        goalType: 'VACATION',
        targetAmount: 350000,
        currentAmount: 110000,
        monthlyContribution: 12000,
        targetDate: new Date('2027-06-30'),
        status: 'ACTIVE',
      },
    ],
  });

  // 10. Portfolio & Investments
  let portfolio = await prisma.portfolio.findFirst({ where: { userId: user.id } });
  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: {
        userId: user.id,
        totalInvested: 245000,
        currentValue: 268400,
      },
    });
  } else {
    await prisma.portfolio.update({
      where: { id: portfolio.id },
      data: { totalInvested: 245000, currentValue: 268400 },
    });
  }

  await prisma.investment.deleteMany({ where: { portfolioId: portfolio.id } });
  await prisma.investment.createMany({
    data: [
      {
        portfolioId: portfolio.id,
        symbol: 'NIFTY50_INDEX',
        name: 'UTI Nifty 50 Index Fund ETF',
        assetType: 'MUTUAL_FUND',
        quantity: 250,
        averageBuyPrice: 240,
      },
      {
        portfolioId: portfolio.id,
        symbol: 'RELIANCE',
        name: 'Reliance Industries Limited',
        assetType: 'STOCK',
        quantity: 25,
        averageBuyPrice: 1180,
      },
      {
        portfolioId: portfolio.id,
        symbol: 'GOLD24K',
        name: '24K Physical Digital Gold (10g)',
        assetType: 'GOLD',
        quantity: 10,
        averageBuyPrice: 12200,
      },
      {
        portfolioId: portfolio.id,
        symbol: 'SILVER_1KG',
        name: '999 Fine Silver Bar Holding (250g)',
        assetType: 'SILVER',
        quantity: 250,
        averageBuyPrice: 165,
      },
    ],
  });

  // 11. Loan
  await prisma.loan.deleteMany({ where: { userId: user.id } });
  await prisma.loan.create({
    data: {
      userId: user.id,
      lenderName: 'HDFC Auto Finance',
      loanType: 'CAR',
      principalAmount: 500000,
      interestRate: 8.5,
      tenureMonths: 60,
      startDate: new Date('2025-06-15'),
      emiAmount: 8900,
      outstandingBalance: 335000,
      status: 'ACTIVE',
    },
  });

  // 12. Insurance
  await prisma.insurancePolicy.deleteMany({ where: { userId: user.id } });
  await prisma.insurancePolicy.createMany({
    data: [
      {
        userId: user.id,
        policyName: 'HDFC ERGO Optima Secure Health',
        insurer: 'HDFC ERGO',
        policyType: 'HEALTH',
        coverageAmount: 1000000,
        premium: 14500,
        premiumCycle: 'ANNUAL',
        renewalDate: new Date('2027-04-15'),
      },
      {
        userId: user.id,
        policyName: 'Tata AIA Sampoorna Raksha Term Plan',
        insurer: 'Tata AIA',
        policyType: 'LIFE',
        coverageAmount: 10000000,
        premium: 18200,
        premiumCycle: 'ANNUAL',
        renewalDate: new Date('2027-08-20'),
      },
    ],
  });

  // 13. Subscriptions
  await prisma.subscription.deleteMany({ where: { userId: user.id } });
  await prisma.subscription.createMany({
    data: [
      {
        userId: user.id,
        serviceName: 'Netflix Ultra HD 4K',
        category: 'Entertainment',
        cost: 649,
        billingCycle: 'MONTHLY',
        nextBillingDate: new Date('2026-11-01'),
      },
      {
        userId: user.id,
        serviceName: 'Spotify Premium Duo',
        category: 'Music & Podcasts',
        cost: 149,
        billingCycle: 'MONTHLY',
        nextBillingDate: new Date('2026-11-05'),
      },
      {
        userId: user.id,
        serviceName: 'Amazon Prime Annual',
        category: 'Shopping & Delivery',
        cost: 125,
        billingCycle: 'MONTHLY',
        nextBillingDate: new Date('2027-01-10'),
      },
      {
        userId: user.id,
        serviceName: 'Cult.fit Elite Fitness Pass',
        category: 'Health & Wellness',
        cost: 1500,
        billingCycle: 'MONTHLY',
        nextBillingDate: new Date('2026-11-15'),
      },
    ],
  });

  // 14. Masked Payment Card
  await prisma.card.deleteMany({ where: { userId: user.id } });
  await prisma.card.create({
    data: {
      userId: user.id,
      cardNickname: 'HDFC Regalia Gold',
      cardType: 'CREDIT',
      issuer: 'HDFC',
      lastFourDigits: '4291',
      creditLimit: 300000,
      outstandingAmount: 42500,
      billingCycleDay: 15,
      rewardCategory: 'Travel & Dining',
    },
  });

  // 15. Financial Tasks
  await prisma.financialTask.deleteMany({ where: { userId: user.id } });
  await prisma.financialTask.createMany({
    data: [
      {
        userId: user.id,
        title: 'Review September credit card statement and verified OCR receipts',
        category: 'CREDIT_CARD',
        dueDate: new Date('2026-10-10'),
        isCompleted: true,
        completedAt: new Date('2026-10-09T18:00:00Z'),
        notes: 'Verify itemized breakdown and confirm tax deductible GST credits.',
      },
      {
        userId: user.id,
        title: 'Rebalance Nifty 50 Index ETF monthly allocation',
        category: 'SIP',
        dueDate: new Date('2026-10-20'),
        isCompleted: false,
        notes: 'Invest surplus cash flow from freelance consulting into index units.',
      },
      {
        userId: user.id,
        title: 'Verify quarterly GST input credit on business invoices',
        category: 'TAX',
        dueDate: new Date('2026-10-25'),
        isCompleted: true,
        completedAt: new Date('2026-10-14T11:20:00Z'),
        notes: 'Cross-check GSTINs for Apollo Pharmacy and Shell station purchases.',
      },
    ],
  });

  console.log('----------------------------------------------------');
  console.log(`✅ SUCCESS: Populated user "jinay":`);
  console.log(`   Email:         ${email}`);
  console.log(`   Username:      ${username}`);
  console.log(`   Password:      Password123!`);
  console.log(`   Transactions:  ${txCount} over the past 50 days (Aug 27 - Oct 16, 2026)`);
  console.log(`   Receipt Scans: ${receiptCount} OCR receipts (Starbucks, DMart, Shell, Apollo, Zara, Amazon)`);
  console.log(`   Budgets:       ${budgets.length} categories active`);
  console.log(`   Goals:         3 savings targets active`);
  console.log(`   Investments:   4 asset classes (Nifty 50, Reliance, 24K Gold, Silver)`);
  console.log(`   Accounts:      3 active accounts (HDFC Salary ₹1.68L, ICICI ₹85k, Zerodha ₹45k)`);
  console.log('----------------------------------------------------');
}

seedJinay50Days()
  .catch((e) => {
    console.error('❌ Seeder error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
