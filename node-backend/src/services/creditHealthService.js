const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');

/**
 * Credit Health & CIBIL Evaluation Service
 * Architecture:
 * - Layer 1: FinPro Credit Health Indicator (Internal 300-900 Score based on actual financial records)
 * - Layer 2: Official CIBIL Bureau Integration (Transparent provider verification)
 * - Layer 3: Credit Education & Actionable Improvement Guidance
 */
class CreditHealthService {
  /**
   * Evaluates user's financial telemetry to compute FinPro Credit Health Indicator
   */
  async evaluateCreditHealth(userId) {
    const [profile, cards, loans, accounts, recentTx] = await Promise.all([
      prisma.financialProfile.findUnique({ where: { userId } }),
      prisma.card.findMany({ where: { userId, isActive: true } }),
      prisma.loan.findMany({ where: { userId, status: 'ACTIVE' } }),
      prisma.financialAccount.findMany({ where: { userId, isActive: true } }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 100,
        select: { amount: true, transactionType: true, date: true, category: { select: { name: true } } },
      }),
    ]);

    const monthlySalary = profile ? parseFloat(profile.monthlySalary || 0) : 0;
    const totalLiquidBalance = accounts.reduce((acc, a) => acc + parseFloat(a.balance || 0), 0);

    // 1. Credit Card Utilization Analysis (Weight: 30%)
    let totalCreditLimit = 0;
    let totalCardOutstanding = 0;
    const creditCards = cards.filter(c => c.cardType === 'CREDIT');

    creditCards.forEach(c => {
      totalCreditLimit += c.creditLimit ? parseFloat(c.creditLimit) : 0;
      totalCardOutstanding += parseFloat(c.outstandingAmount || 0);
    });

    const utilizationPct = totalCreditLimit > 0
      ? Math.round((totalCardOutstanding / totalCreditLimit) * 10000) / 100
      : 0;

    let utilizationScore = 150; // out of 180 points (30% of 600 base spread)
    if (totalCreditLimit > 0) {
      if (utilizationPct <= 10) utilizationScore = 180;
      else if (utilizationPct <= 30) utilizationScore = 160;
      else if (utilizationPct <= 50) utilizationScore = 110;
      else if (utilizationPct <= 75) utilizationScore = 60;
      else utilizationScore = 20;
    } else {
      utilizationScore = 120; // neutral if no cards
    }

    // 2. Debt-To-Income (DTI) & EMI Burden (Weight: 25%)
    let totalMonthlyEMI = 0;
    let totalLoanOutstanding = 0;
    loans.forEach(l => {
      totalMonthlyEMI += l.emiAmount ? parseFloat(l.emiAmount) : 0;
      totalLoanOutstanding += parseFloat(l.outstandingBalance || 0);
    });

    const dtiPct = monthlySalary > 0
      ? Math.round((totalMonthlyEMI / monthlySalary) * 10000) / 100
      : (totalMonthlyEMI > 0 ? 50 : 0);

    let dtiScore = 120; // out of 150 points (25% of 600 base spread)
    if (monthlySalary > 0) {
      if (dtiPct <= 15) dtiScore = 150;
      else if (dtiPct <= 30) dtiScore = 135;
      else if (dtiPct <= 45) dtiScore = 90;
      else if (dtiPct <= 60) dtiScore = 50;
      else dtiScore = 15;
    }

    // 3. Payment Discipline & Cashflow Buffer (Weight: 25%)
    let paymentScore = 120; // out of 150 points
    const monthlyExpenses = recentTx
      .filter(t => t.transactionType === 'EXPENSE')
      .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

    const savingsRatio = monthlySalary > 0 && monthlyExpenses > 0
      ? (monthlySalary - (monthlyExpenses / 3)) / monthlySalary
      : 0.2;

    if (savingsRatio >= 0.3) paymentScore = 150;
    else if (savingsRatio >= 0.15) paymentScore = 125;
    else if (savingsRatio >= 0) paymentScore = 90;
    else paymentScore = 40;

    // 4. Credit Mix & Depth (Weight: 10%)
    let creditMixScore = 30; // out of 60 points
    const hasRevolving = creditCards.length > 0;
    const hasInstallment = loans.length > 0;
    if (hasRevolving && hasInstallment) creditMixScore = 60;
    else if (hasRevolving || hasInstallment) creditMixScore = 45;
    else creditMixScore = 30;

    // 5. Liquidity / Emergency Cushion (Weight: 10%)
    let liquidityScore = 30; // out of 60 points
    const monthsCovered = totalMonthlyEMI > 0
      ? totalLiquidBalance / (totalMonthlyEMI + (monthlyExpenses / 3 || 10000))
      : totalLiquidBalance / (monthlyExpenses / 3 || 10000);

    if (monthsCovered >= 6) liquidityScore = 60;
    else if (monthsCovered >= 3) liquidityScore = 50;
    else if (monthsCovered >= 1) liquidityScore = 35;
    else liquidityScore = 20;

    // Base score = 300, max spread = 600 -> Total = 300 to 900
    const totalSpread = utilizationScore + dtiScore + paymentScore + creditMixScore + liquidityScore;
    const finproCreditScore = Math.min(900, Math.max(300, Math.round(300 + totalSpread)));

    // Categorization
    let scoreTier = 'GOOD';
    let tierColor = '#10B981';
    if (finproCreditScore >= 780) {
      scoreTier = 'EXCELLENT';
      tierColor = '#059669';
    } else if (finproCreditScore >= 700) {
      scoreTier = 'GOOD';
      tierColor = '#10B981';
    } else if (finproCreditScore >= 620) {
      scoreTier = 'FAIR';
      tierColor = '#F59E0B';
    } else {
      scoreTier = 'POOR';
      tierColor = '#EF4444';
    }

    // Official Bureau Integration Telemetry
    const bureauApiKey = process.env.CIBIL_API_KEY || process.env.EXPERIAN_API_KEY;
    const isBureauConfigured = !!(bureauApiKey && bureauApiKey !== 'YOUR_CIBIL_API_KEY');

    return {
      success: true,
      timestamp: new Date().toISOString(),
      // Layer 1: Internal Indicator
      finproIndicator: {
        score: finproCreditScore,
        scoreRange: '300 - 900',
        scoreTier,
        tierColor,
        title: 'FinPro Credit Health Indicator — Not an official CIBIL score',
        methodology: {
          description: 'Calculated using real user financial factors: credit utilization, debt-to-income (DTI), cashflow cushion, credit mix diversity, and liquidity resilience.',
          factors: [
            {
              name: 'Credit Card Utilization',
              weight: '30%',
              score: `${utilizationScore}/180`,
              status: utilizationPct <= 30 ? 'OPTIMAL' : (utilizationPct <= 50 ? 'MODERATE' : 'HIGH_RISK'),
              value: totalCreditLimit > 0 ? `${utilizationPct}%` : 'N/A (No active cards)',
              benchmark: 'Target < 30%',
            },
            {
              name: 'Debt-To-Income (DTI) Burden',
              weight: '25%',
              score: `${dtiScore}/150`,
              status: dtiPct <= 30 ? 'COMFORTABLE' : (dtiPct <= 45 ? 'MANAGEABLE' : 'HEAVY'),
              value: `${dtiPct}%`,
              benchmark: 'Target < 35% of monthly income',
            },
            {
              name: 'Cashflow Savings Cushion',
              weight: '25%',
              score: `${paymentScore}/150`,
              status: savingsRatio >= 0.2 ? 'STRONG' : 'MODERATE',
              value: `${Math.round(savingsRatio * 100)}% savings rate`,
              benchmark: 'Target > 20% savings buffer',
            },
            {
              name: 'Credit Mix Diversity',
              weight: '10%',
              score: `${creditMixScore}/60`,
              status: hasRevolving && hasInstallment ? 'DIVERSIFIED' : 'MODERATE',
              value: `${creditCards.length} Cards, ${loans.length} Loans`,
              benchmark: 'Healthy balance of revolving and installment credit',
            },
            {
              name: 'Emergency Liquidity Runway',
              weight: '10%',
              score: `${liquidityScore}/60`,
              status: monthsCovered >= 3 ? 'SECURE' : 'LOW',
              value: `${Math.round(monthsCovered * 10) / 10} months buffer`,
              benchmark: 'Target 3-6 months fixed expenses',
            },
          ],
        },
        financialTelemetry: {
          activeCreditCards: creditCards.length,
          totalCreditLimit,
          formattedTotalCreditLimit: formatINR(totalCreditLimit),
          totalCardOutstanding,
          formattedTotalCardOutstanding: formatINR(totalCardOutstanding),
          activeLoans: loans.length,
          totalLoanOutstanding,
          formattedTotalLoanOutstanding: formatINR(totalLoanOutstanding),
          monthlyEMIBurden: totalMonthlyEMI,
          formattedMonthlyEMIBurden: formatINR(totalMonthlyEMI),
          liquidAssets: totalLiquidBalance,
          formattedLiquidAssets: formatINR(totalLiquidBalance),
        },
      },
      // Layer 2: Official CIBIL / Bureau Integration Status
      officialBureauIntegration: {
        provider: 'TransUnion CIBIL / Experian India',
        status: isBureauConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
        notice: isBureauConfigured
          ? 'Authorized credit bureau API connected.'
          : 'Official CIBIL score integration requires an authorized credit-bureau service API key (TransUnion CIBIL API / Experian API partner agreement). FinPro does not fabricate unofficial credit scores.',
        officialScoreAvailable: false,
      },
      // Layer 3: Educational Reference
      education: {
        whatIsCIBIL: 'A 3-digit numeric summary (ranging 300 to 900) computed by the Credit Information Bureau (India) Limited (TransUnion CIBIL), reflecting your creditworthiness based on borrowing and repayment records.',
        keyBureauFactors: [
          { factor: 'Payment History', impact: '35%', tip: 'Never default or delay loan EMIs or credit card minimum dues.' },
          { factor: 'Credit Exposure & Utilization', impact: '30%', tip: 'Keep total credit card spending under 30% of your total credit limit.' },
          { factor: 'Credit History Age', impact: '15%', tip: 'Maintain old credit card accounts; long track records build credit stability.' },
          { factor: 'Credit Mix', impact: '10%', tip: 'A healthy balance of secured (home/auto) and unsecured (card/personal) debt is favorable.' },
          { factor: 'Recent Hard Inquiries', impact: '10%', tip: 'Avoid applying for multiple credit cards or loans within a short span.' },
        ],
      },
    };
  }
}

module.exports = new CreditHealthService();
