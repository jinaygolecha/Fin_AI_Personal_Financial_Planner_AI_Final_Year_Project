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

  console.log('✅ Jinay Finance AI database seeded successfully!');
  console.log('👉 Demo Credentials: demo@example.com / DemoPassword123!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
