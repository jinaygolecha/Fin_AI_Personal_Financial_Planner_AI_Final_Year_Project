/**
 * Jinay Finance AI — Safe Database Seeder
 * Populates sample development data for testing & demonstrations.
 * NEVER seeds real personal credentials.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Jinay Finance AI database seed...');

  const demoEmail = 'demo@example.com';
  const hashedPassword = await bcrypt.hash('DemoPassword123!', 10);

  // 1. Upsert Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      email: demoEmail,
      username: 'demouser',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      isActive: true,
      currency: 'INR',
      profile: {
        create: {
          occupation: 'Software Engineer',
          bio: 'FinTech Demo Account',
        },
      },
    },
    include: { profile: true },
  });

  console.log(`  👤 User created: ${demoUser.email} (ID: ${demoUser.id})`);

  // 2. Financial Profile & Plan
  await prisma.financialProfile.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      age: 25,
      city: 'Mumbai',
      monthlySalary: 100000,
      estimatedMonthlyExpenses: 35000,
      currentSavings: 150000,
      totalDebt: 0,
      riskProfile: 'MODERATE',
      isOnboardingComplete: true,
    },
  });

  await prisma.financialPlan.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      income: 100000,
      expenses: 35000,
      savingsTarget: 20000,
      emergencyFundTarget: 200000,
      investmentTarget: 45000,
      financialHealthScore: 78,
      riskProfile: 'Moderate',
      budgetMethod: '50/30/20',
      planSummary: 'Balanced 50/30/20 financial wealth allocation',
    },
  });

  // 3. Accounts
  let salaryAcc = await prisma.financialAccount.findFirst({
    where: { userId: demoUser.id, name: 'HDFC Salary Account' },
  });
  if (!salaryAcc) {
    salaryAcc = await prisma.financialAccount.create({
      data: {
        userId: demoUser.id,
        name: 'HDFC Salary Account',
        accountType: 'SAVINGS',
        accountNumberMasked: '•••• 4589',
        balance: 125000,
        currency: 'INR',
      },
    });
  }

  let tradingAcc = await prisma.financialAccount.findFirst({
    where: { userId: demoUser.id, name: 'Zerodha Trading Account' },
  });
  if (!tradingAcc) {
    tradingAcc = await prisma.financialAccount.create({
      data: {
        userId: demoUser.id,
        name: 'Zerodha Trading Account',
        accountType: 'OTHER',
        accountNumberMasked: '•••• ZR01',
        balance: 50000,
        currency: 'INR',
      },
    });
  }

  // 4. Sample Transactions
  const existingTxCount = await prisma.transaction.count({ where: { userId: demoUser.id } });
  if (existingTxCount === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          userId: demoUser.id,
          accountId: salaryAcc.id,
          amount: 100000,
          transactionType: 'INCOME',
          description: 'Monthly Salary Credit',
          date: new Date(),
        },
        {
          userId: demoUser.id,
          accountId: salaryAcc.id,
          amount: 22000,
          transactionType: 'EXPENSE',
          description: 'Apartment Monthly Rent',
          date: new Date(Date.now() - 3 * 86400000),
        },
        {
          userId: demoUser.id,
          accountId: salaryAcc.id,
          amount: 6500,
          transactionType: 'EXPENSE',
          description: 'Groceries and Supermarket',
          date: new Date(Date.now() - 2 * 86400000),
        },
        {
          userId: demoUser.id,
          accountId: salaryAcc.id,
          amount: 15000,
          transactionType: 'INVESTMENT',
          description: 'Nifty 50 Index Fund Monthly SIP',
          date: new Date(Date.now() - 1 * 86400000),
        },
      ],
    });
  }

  // 5. Budgets
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  await prisma.budget.upsert({
    where: { userId_categoryName_month_year: { userId: demoUser.id, categoryName: 'Food & Dining', month, year } },
    update: {},
    create: {
      userId: demoUser.id,
      categoryName: 'Food & Dining',
      monthlyLimit: 15000,
      month,
      year,
    },
  });

  await prisma.budget.upsert({
    where: { userId_categoryName_month_year: { userId: demoUser.id, categoryName: 'Housing', month, year } },
    update: {},
    create: {
      userId: demoUser.id,
      categoryName: 'Housing',
      monthlyLimit: 25000,
      month,
      year,
    },
  });

  // 6. Savings Goals
  const existingGoals = await prisma.goal.count({ where: { userId: demoUser.id } });
  if (existingGoals === 0) {
    await prisma.goal.createMany({
      data: [
        {
          userId: demoUser.id,
          name: 'Emergency Fund (6 Months)',
          goalType: 'EMERGENCY_FUND',
          targetAmount: 200000,
          currentAmount: 85000,
          monthlyContribution: 15000,
          targetDate: new Date(Date.now() + 180 * 86400000),
        },
        {
          userId: demoUser.id,
          name: 'Home Down Payment',
          goalType: 'HOME',
          targetAmount: 1000000,
          currentAmount: 250000,
          monthlyContribution: 25000,
          targetDate: new Date(Date.now() + 720 * 86400000),
        },
      ],
    });
  }

  // 7. Portfolio & Holdings
  let portfolio = await prisma.portfolio.findFirst({ where: { userId: demoUser.id } });
  if (!portfolio) {
    portfolio = await prisma.portfolio.create({
      data: {
        userId: demoUser.id,
        totalInvested: 225000,
        currentValue: 245000,
      },
    });
  }

  const existingInv = await prisma.investment.count({ where: { portfolioId: portfolio.id } });
  if (existingInv === 0) {
    await prisma.investment.createMany({
      data: [
        {
          portfolioId: portfolio.id,
          symbol: 'RELIANCE',
          name: 'Reliance Industries Ltd',
          assetType: 'STOCK',
          quantity: 20,
          averageBuyPrice: 2450,
        },
        {
          portfolioId: portfolio.id,
          symbol: 'NIFTY50_INDEX',
          name: 'UTI Nifty 50 Index Fund',
          assetType: 'MUTUAL_FUND',
          quantity: 500,
          averageBuyPrice: 200,
        },
        {
          portfolioId: portfolio.id,
          symbol: 'GOLD24K',
          name: '24K Physical Gold (10g)',
          assetType: 'GOLD',
          quantity: 10,
          averageBuyPrice: 7600,
        },
      ],
    });
  }

  // 8. Insurance Policies
  const existingPolicies = await prisma.insurancePolicy.count({ where: { userId: demoUser.id } });
  if (existingPolicies === 0) {
    await prisma.insurancePolicy.createMany({
      data: [
        {
          userId: demoUser.id,
          policyName: 'HDFC Click 2 Protect Term Plan',
          insurer: 'HDFC Life',
          policyType: 'LIFE',
          coverageAmount: 10000000,
          premium: 16500,
          premiumCycle: 'ANNUAL',
          renewalDate: new Date('2027-03-31'),
        },
        {
          userId: demoUser.id,
          policyName: 'Star Health Comprehensive Plan',
          insurer: 'Star Health',
          policyType: 'HEALTH',
          coverageAmount: 1000000,
          premium: 14000,
          premiumCycle: 'ANNUAL',
          renewalDate: new Date('2026-11-15'),
        },
      ],
    });
  }

  // 9. Subscriptions
  const existingSubs = await prisma.subscription.count({ where: { userId: demoUser.id } });
  if (existingSubs === 0) {
    await prisma.subscription.createMany({
      data: [
        {
          userId: demoUser.id,
          serviceName: 'Netflix Premium 4K',
          category: 'Entertainment',
          cost: 649,
          billingCycle: 'MONTHLY',
          nextBillingDate: new Date('2026-09-01'),
        },
        {
          userId: demoUser.id,
          serviceName: 'Spotify Premium Duo',
          category: 'Music & Audio',
          cost: 179,
          billingCycle: 'MONTHLY',
          nextBillingDate: new Date('2026-09-05'),
        },
      ],
    });
  }

  console.log('✅ Base demo account created.');

  // ============================================================
  // JINAY DEMONSTRATION ACCOUNT (Academic Test Profile: 21yo Student)
  // ============================================================
  const jinayEmail = 'jinay.demo@finpro.local';
  const jinayPassword = await bcrypt.hash('project@123', 12);

  const jinayUser = await prisma.user.upsert({
    where: { email: jinayEmail },
    update: {
      password: jinayPassword,
      firstName: 'Jinay',
      lastName: 'Golecha',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
    create: {
      email: jinayEmail,
      username: 'jinay',
      password: jinayPassword,
      firstName: 'Jinay',
      lastName: 'Golecha',
      isActive: true,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      country: 'India',
      profile: {
        create: {
          bio: 'Final Year Student & Software Engineering Intern | FinPro Demo Account',
          occupation: 'Student & Software Intern',
        },
      },
    },
  });

  console.log(`  🎓 JINAY Demo User initialized: ${jinayUser.email} (ID: ${jinayUser.id})`);

  // Financial Profile (21-year-old student, ₹12,300 stipend, ₹48k device EMI)
  await prisma.financialProfile.upsert({
    where: { userId: jinayUser.id },
    update: {
      monthlySalary: 12300,
      estimatedMonthlyExpenses: 8400,
      currentSavings: 24500,
      totalDebt: 36800,
      riskProfile: 'MODERATE',
      isOnboardingComplete: true,
    },
    create: {
      userId: jinayUser.id,
      age: 21,
      city: 'Pune',
      monthlySalary: 12300,
      estimatedMonthlyExpenses: 8400,
      currentSavings: 24500,
      totalDebt: 36800,
      riskProfile: 'MODERATE',
      isOnboardingComplete: true,
    },
  });

  await prisma.financialPlan.upsert({
    where: { userId: jinayUser.id },
    update: {
      income: 12300,
      expenses: 8400,
      savingsTarget: 2500,
      emergencyFundTarget: 25000,
      investmentTarget: 1400,
      financialHealthScore: 82,
      riskProfile: 'Moderate',
      budgetMethod: '50/30/20',
      planSummary: 'Balanced student 50/30/20 budget with ₹12,300/mo stipend and ₹4,265/mo Electronic Device EMI obligation.',
    },
    create: {
      userId: jinayUser.id,
      income: 12300,
      expenses: 8400,
      savingsTarget: 2500,
      emergencyFundTarget: 25000,
      investmentTarget: 1400,
      financialHealthScore: 82,
      riskProfile: 'Moderate',
      budgetMethod: '50/30/20',
      planSummary: 'Balanced student 50/30/20 budget with ₹12,300/mo stipend and ₹4,265/mo Electronic Device EMI obligation.',
    },
  });

  // Accounts: Student Savings & UPI Wallet
  let studentBank = await prisma.financialAccount.findFirst({
    where: { userId: jinayUser.id, name: 'HDFC Student Savings' },
  });
  if (!studentBank) {
    studentBank = await prisma.financialAccount.create({
      data: {
        userId: jinayUser.id,
        name: 'HDFC Student Savings',
        accountType: 'SAVINGS',
        accountNumberMasked: '•••• 8821',
        balance: 24500,
        currency: 'INR',
      },
    });
  }

  let upiWallet = await prisma.financialAccount.findFirst({
    where: { userId: jinayUser.id, name: 'UPI Digital Wallet' },
  });
  if (!upiWallet) {
    upiWallet = await prisma.financialAccount.create({
      data: {
        userId: jinayUser.id,
        name: 'UPI Digital Wallet',
        accountType: 'WALLET',
        accountNumberMasked: '•••• 9104',
        balance: 1850,
        currency: 'INR',
      },
    });
  }

  // Historical Stipends (4 consecutive months of ₹12,300)
  const jinayTxCount = await prisma.transaction.count({ where: { userId: jinayUser.id } });
  if (jinayTxCount === 0) {
    const now = new Date();
    const stipendEntries = [0, 1, 2, 3].map((monthsAgo) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - monthsAgo);
      d.setDate(1);
      return {
        userId: jinayUser.id,
        accountId: studentBank.id,
        amount: 12300,
        transactionType: 'INCOME',
        aiCategory: 'Internship Stipend',
        description: `Monthly Internship Stipend Credit (${d.toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        date: d,
      };
    });

    const expenseEntries = [
      { cat: 'College / Education', desc: 'Semester Examination & Lab Fee', amt: 1500, daysAgo: 25 },
      { cat: 'College / Education', desc: 'Final Year Project Component Kit', amt: 750, daysAgo: 14 },
      { cat: 'Books', desc: 'Distributed Systems & Data Algorithms Textbooks', amt: 850, daysAgo: 20 },
      { cat: 'Stationery', desc: 'Spiral Notebooks & Project Binders', amt: 220, daysAgo: 18 },
      { cat: 'Groceries', desc: 'Monthly Hostel Pantry & Provisions', amt: 1200, daysAgo: 10 },
      { cat: 'Milk', desc: 'Fresh Milk & Dairy Supply', amt: 480, daysAgo: 6 },
      { cat: 'Electricity', desc: 'Room Electricity Utility Bill', amt: 650, daysAgo: 12 },
      { cat: 'Office Electricity', desc: 'Project Workstation UPS & Backup Power', amt: 320, daysAgo: 15 },
      { cat: 'Internet', desc: 'High-Speed Fiber Broadband Bill', amt: 599, daysAgo: 8 },
      { cat: 'Mobile Recharge', desc: 'Monthly 5G Unlimited Prepaid Pack', amt: 299, daysAgo: 9 },
      { cat: 'Transportation', desc: 'Monthly City Metro & Bus Transit Card', amt: 650, daysAgo: 5 },
      { cat: 'Food', desc: 'Campus Food & Dining Hall Coupon', amt: 2100, daysAgo: 11 },
      { cat: 'Eating Out', desc: 'Weekend Team Lunch & Cafe Snacks', amt: 450, daysAgo: 3 },
      { cat: 'Software / Subscriptions', desc: 'Cloud Developer Lab Hosting', amt: 499, daysAgo: 7 },
      { cat: 'Healthcare', desc: 'Multivitamins & Medical Essentials', amt: 350, daysAgo: 16 },
      { cat: 'Personal', desc: 'Personal Care & Grooming Essentials', amt: 400, daysAgo: 21 },
      { cat: 'Entertainment', desc: 'Weekend Cinema Movie Ticket', amt: 350, daysAgo: 4 },
      { cat: 'Miscellaneous', desc: 'Project Color Printouts & Documentation Binding', amt: 280, daysAgo: 2 },
    ].map((item) => {
      const d = new Date(now);
      d.setDate(d.getDate() - item.daysAgo);
      return {
        userId: jinayUser.id,
        accountId: studentBank.id,
        amount: item.amt,
        transactionType: 'EXPENSE',
        aiCategory: item.cat,
        description: item.desc,
        date: d,
      };
    });

    await prisma.transaction.createMany({
      data: [...stipendEntries, ...expenseEntries],
    });
    console.log(`  💳 Populated ${stipendEntries.length + expenseEntries.length} realistic financial entries.`);
  }

  // Mathematically Consistent Electronic Device EMI (Principal ₹48,000, 12% p.a., 12 mos, EMI ₹4,265)
  const existingLoan = await prisma.loan.findFirst({ where: { userId: jinayUser.id } });
  if (!existingLoan) {
    const loanStartDate = new Date();
    loanStartDate.setMonth(loanStartDate.getMonth() - 3);
    await prisma.loan.create({
      data: {
        userId: jinayUser.id,
        lenderName: 'HDFC Consumer Finance',
        loanType: 'PERSONAL',
        principalAmount: 48000,
        interestRate: 12.0,
        tenureMonths: 12,
        startDate: loanStartDate,
        emiAmount: 4265,
        outstandingBalance: 36800,
        status: 'ACTIVE',
      },
    });
    console.log('  💻 Created Electronic Device EMI obligation: ₹48,000 @ 12% for 12 mos (₹4,265/mo).');
  }

  // Budgets (50/30/20 standard)
  const jinayBudgetsCount = await prisma.budget.count({ where: { userId: jinayUser.id } });
  if (jinayBudgetsCount === 0) {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    await prisma.budget.createMany({
      data: [
        {
          userId: jinayUser.id,
          categoryName: 'Food & Dining',
          monthlyLimit: 2500,
          month: currentMonth,
          year: currentYear,
        },
        {
          userId: jinayUser.id,
          categoryName: 'College / Education',
          monthlyLimit: 2500,
          month: currentMonth,
          year: currentYear,
        },
        {
          userId: jinayUser.id,
          categoryName: 'Internet & Utilities',
          monthlyLimit: 800,
          month: currentMonth,
          year: currentYear,
        },
      ],
    });
  }

  // Goals
  const jinayGoalsCount = await prisma.goal.count({ where: { userId: jinayUser.id } });
  if (jinayGoalsCount === 0) {
    await prisma.goal.createMany({
      data: [
        {
          userId: jinayUser.id,
          name: 'Student Emergency Reserve Fund',
          goalType: 'EMERGENCY_FUND',
          targetAmount: 25000,
          currentAmount: 12000,
          monthlyContribution: 1500,
          targetDate: new Date(Date.now() + 180 * 86400000),
          status: 'ACTIVE',
        },
        {
          userId: jinayUser.id,
          name: 'AWS Cloud & AI Certification',
          goalType: 'EDUCATION',
          targetAmount: 10000,
          currentAmount: 4500,
          monthlyContribution: 1000,
          targetDate: new Date(Date.now() + 120 * 86400000),
          status: 'ACTIVE',
        },
      ],
    });
  }

  // Investments (Nifty 50 + 24K Gold)
  let jinayPortfolio = await prisma.portfolio.findFirst({ where: { userId: jinayUser.id } });
  if (!jinayPortfolio) {
    jinayPortfolio = await prisma.portfolio.create({
      data: {
        userId: jinayUser.id,
        totalInvested: 9500,
        currentValue: 10250,
      },
    });
  }
  const jinayInvCount = await prisma.investment.count({ where: { portfolioId: jinayPortfolio.id } });
  if (jinayInvCount === 0) {
    await prisma.investment.createMany({
      data: [
        {
          portfolioId: jinayPortfolio.id,
          symbol: 'NIFTY50_INDEX',
          name: 'UTI Nifty 50 Index Fund',
          assetType: 'MUTUAL_FUND',
          quantity: 30,
          averageBuyPrice: 200,
        },
        {
          portfolioId: jinayPortfolio.id,
          symbol: 'GOLD24K',
          name: '24K Digital Gold (0.5g)',
          assetType: 'GOLD',
          quantity: 0.5,
          averageBuyPrice: 7000,
        },
      ],
    });
  }

  // Insurance
  const jinayPolicies = await prisma.insurancePolicy.count({ where: { userId: jinayUser.id } });
  if (jinayPolicies === 0) {
    await prisma.insurancePolicy.create({
      data: {
        userId: jinayUser.id,
        policyName: 'Star Student Care Health Shield',
        insurer: 'Star Health',
        policyType: 'HEALTH',
        coverageAmount: 200000,
        premium: 2400,
        premiumCycle: 'ANNUAL',
        renewalDate: new Date(Date.now() + 240 * 86400000),
      },
    });
  }

  // Subscriptions
  const jinaySubs = await prisma.subscription.count({ where: { userId: jinayUser.id } });
  if (jinaySubs === 0) {
    await prisma.subscription.createMany({
      data: [
        {
          userId: jinayUser.id,
          serviceName: 'Spotify Student Premium',
          category: 'Music & Audio',
          cost: 59,
          billingCycle: 'MONTHLY',
          nextBillingDate: new Date(Date.now() + 15 * 86400000),
        },
        {
          userId: jinayUser.id,
          serviceName: 'JioFiber Student Plan',
          category: 'Internet',
          cost: 599,
          billingCycle: 'MONTHLY',
          nextBillingDate: new Date(Date.now() + 22 * 86400000),
        },
      ],
    });
  }

  // Cards (Safe Masked Card - No PAN, No CVV)
  const jinayCards = await prisma.card.count({ where: { userId: jinayUser.id } });
  if (jinayCards === 0) {
    await prisma.card.create({
      data: {
        userId: jinayUser.id,
        cardNickname: 'HDFC Student Platinum Debit',
        cardType: 'DEBIT',
        issuer: 'HDFC Bank',
        lastFourDigits: '8812',
        creditLimit: 0,
        outstandingAmount: 0,
      },
    });
  }

  // Financial Tasks
  const jinayTasks = await prisma.financialTask.count({ where: { userId: jinayUser.id } });
  if (jinayTasks === 0) {
    await prisma.financialTask.createMany({
      data: [
        {
          userId: jinayUser.id,
          title: 'Review monthly internship stipend credit',
          category: 'GENERAL',
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 3 * 86400000),
        },
        {
          userId: jinayUser.id,
          title: 'Pay hostel fiber broadband bill',
          category: 'GENERAL',
          priority: 'MEDIUM',
          dueDate: new Date(Date.now() + 7 * 86400000),
        },
      ],
    });
  }

  console.log('✅ FinPro Academic Demonstration Account (JINAY) successfully seeded!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
