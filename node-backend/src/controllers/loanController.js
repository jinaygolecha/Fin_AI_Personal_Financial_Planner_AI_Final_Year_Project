const prisma = require('../config/database');
const { formatINR } = require('../utils/inr');
const { calculateEMI, simulatePrepayment } = require('../utils/financialMath');

/**
 * GET /api/v1/loans
 */
const getLoans = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const loans = await prisma.loan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalOutstanding = loans.reduce((s, l) => s + parseFloat(l.outstandingBalance || 0), 0);
    const totalEMI = loans.filter(l => l.status === 'ACTIVE').reduce((s, l) => s + parseFloat(l.emiAmount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        totalOutstanding,
        formattedTotalOutstanding: formatINR(totalOutstanding),
        totalMonthlyEMI: totalEMI,
        formattedTotalMonthlyEMI: formatINR(totalEMI),
        loans: loans.map((l) => ({
          id: l.id,
          loanType: l.loanType,
          lenderName: l.lenderName,
          principalAmount: parseFloat(l.principalAmount),
          formattedPrincipal: formatINR(l.principalAmount),
          interestRate: parseFloat(l.interestRate),
          tenureMonths: l.tenureMonths,
          startDate: l.startDate,
          emiAmount: parseFloat(l.emiAmount || 0),
          formattedEMI: formatINR(l.emiAmount || 0),
          outstandingBalance: parseFloat(l.outstandingBalance),
          formattedOutstanding: formatINR(l.outstandingBalance),
          status: l.status,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/loans
 */
const createLoan = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { loanType = 'PERSONAL', lenderName, principalAmount, interestRate, tenureMonths, startDate } = req.body;

    const principal = parseFloat(principalAmount);
    const rate = parseFloat(interestRate);
    const tenure = parseInt(tenureMonths);

    if (!principal || !rate || !tenure) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Principal amount, interest rate, and tenure are required.' },
      });
    }

    const emi = calculateEMI(principal, rate, tenure);

    const loan = await prisma.loan.create({
      data: {
        userId,
        loanType,
        lenderName: lenderName?.trim() || null,
        principalAmount: principal,
        interestRate: rate,
        tenureMonths: tenure,
        startDate: startDate ? new Date(startDate) : new Date(),
        emiAmount: emi,
        outstandingBalance: principal,
        status: 'ACTIVE',
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...loan,
        formattedEMI: formatINR(emi),
        formattedPrincipal: formatINR(principal),
        message: `Loan added! Monthly EMI: ${formatINR(emi)}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/loans/prepayment-simulate
 */
const simulatePrepaymentHandler = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { loanId, prepaymentAmount } = req.body;

    const prepayment = parseFloat(prepaymentAmount);
    if (!prepayment || prepayment <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prepayment amount must be greater than zero.' },
      });
    }

    let principal, rate, tenure;

    if (loanId) {
      const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } });
      if (!loan) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Loan not found.' },
        });
      }
      principal = parseFloat(loan.outstandingBalance);
      rate = parseFloat(loan.interestRate);
      tenure = loan.tenureMonths;
    } else {
      // Default simulation values (10 lakh @ 8.5% for 120 months)
      principal = 1000000;
      rate = 8.5;
      tenure = 120;
    }

    const result = simulatePrepayment(principal, rate, tenure, prepayment);

    return res.status(200).json({
      success: true,
      data: {
        originalPrincipal: principal,
        formattedOriginalPrincipal: formatINR(principal),
        prepaymentAmount: prepayment,
        formattedPrepayment: formatINR(prepayment),
        monthsSaved: result.monthsSaved,
        interestSaved: result.interestSaved,
        formattedInterestSaved: formatINR(result.interestSaved),
        newEMI: result.newEmi,
        formattedNewEMI: formatINR(result.newEmi),
        summary: `By prepaying ${formatINR(prepayment)}, you save approximately ${formatINR(result.interestSaved)} in interest and reduce your loan by ${result.monthsSaved} months!`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/loans/calculate-emi
 * Quick EMI calculator without saving
 */
const calculateEMIHandler = async (req, res, next) => {
  try {
    const { principal, interestRate, tenureMonths } = req.body;
    const p = parseFloat(principal);
    const r = parseFloat(interestRate);
    const n = parseInt(tenureMonths);

    if (!p || !r || !n) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Principal, interest rate, and tenure are required.' },
      });
    }

    const emi = calculateEMI(p, r, n);
    const totalPayment = emi * n;
    const totalInterest = totalPayment - p;

    return res.status(200).json({
      success: true,
      data: {
        emi,
        formattedEMI: formatINR(emi),
        totalPayment,
        formattedTotalPayment: formatINR(totalPayment),
        totalInterest,
        formattedTotalInterest: formatINR(totalInterest),
        principal: p,
        formattedPrincipal: formatINR(p),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getLoans, createLoan, simulatePrepaymentHandler, calculateEMIHandler };
