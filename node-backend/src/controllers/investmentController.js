const prisma = require('../config/database');
const marketService = require('../services/marketService');
const { formatINR } = require('../utils/inr');

/**
 * GET /api/v1/investments/portfolio
 */
const getPortfolio = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let portfolio = await prisma.portfolio.findUnique({
      where: { userId },
      include: { investments: true },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId, totalInvested: 0, currentValue: 0 },
        include: { investments: true },
      });
    }

    let totalInvested = 0;
    let currentPortfolioValue = 0;
    const items = [];

    for (const inv of portfolio.investments) {
      const quote = await marketService.getQuote(inv.symbol);
      const qty = parseFloat(inv.quantity);
      const avgBuy = parseFloat(inv.averageBuyPrice);
      const currPrice = quote.price;

      const costBasis = qty * avgBuy;
      const currVal = qty * currPrice;
      const pnl = currVal - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      totalInvested += costBasis;
      currentPortfolioValue += currVal;

      items.push({
        id: inv.id,
        symbol: inv.symbol,
        name: inv.name || quote.name || inv.symbol,
        assetType: inv.assetType,
        quantity: qty,
        averageBuyPrice: avgBuy,
        formattedBuyPrice: formatINR(avgBuy),
        currentPrice: currPrice,
        formattedCurrentPrice: formatINR(currPrice),
        totalCost: costBasis,
        formattedCost: formatINR(costBasis),
        currentValue: currVal,
        formattedCurrentValue: formatINR(currVal),
        pnl,
        formattedPnl: formatINR(pnl),
        pnlPercent: Math.round(pnlPct * 100) / 100,
        marketStatus: quote.marketStatus,
        timestamp: quote.timestamp,
        source: quote.source,
      });
    }

    // Update portfolio totals
    await prisma.portfolio.update({
      where: { userId },
      data: { totalInvested, currentValue: currentPortfolioValue },
    });

    const totalPnl = currentPortfolioValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalInvested,
        formattedTotalInvested: formatINR(totalInvested),
        currentValue: currentPortfolioValue,
        formattedCurrentValue: formatINR(currentPortfolioValue),
        totalPnl,
        formattedTotalPnl: formatINR(totalPnl),
        totalPnlPercent: Math.round(totalPnlPct * 100) / 100,
        holdings: items,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/investments/buy
 */
const buyInvestment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { symbol, name, assetType = 'STOCK', quantity, buyPrice } = req.body;

    const qty = parseFloat(quantity);
    const price = parseFloat(buyPrice);

    if (!symbol || !qty || !price || qty <= 0 || price <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Symbol, quantity, and buy price are required (all must be positive).' },
      });
    }

    let portfolio = await prisma.portfolio.findUnique({ where: { userId } });
    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: { userId, totalInvested: 0, currentValue: 0 },
      });
    }

    const symbolUpper = symbol.toUpperCase().trim();

    // Upsert investment (if already held, update weighted average)
    const existing = await prisma.investment.findFirst({
      where: { portfolioId: portfolio.id, symbol: symbolUpper },
    });

    let investment;
    if (existing) {
      const newQty = parseFloat(existing.quantity) + qty;
      const newAvgPrice = (parseFloat(existing.quantity) * parseFloat(existing.averageBuyPrice) + qty * price) / newQty;

      investment = await prisma.investment.update({
        where: { id: existing.id },
        data: { quantity: newQty, averageBuyPrice: newAvgPrice },
      });
    } else {
      investment = await prisma.investment.create({
        data: {
          portfolioId: portfolio.id,
          symbol: symbolUpper,
          name: name || symbolUpper,
          assetType,
          quantity: qty,
          averageBuyPrice: price,
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: investment.id,
        symbol: investment.symbol,
        quantity: parseFloat(investment.quantity),
        averageBuyPrice: parseFloat(investment.averageBuyPrice),
        formattedBuyPrice: formatINR(investment.averageBuyPrice),
        totalCost: qty * price,
        formattedTotalCost: formatINR(qty * price),
        message: `Successfully bought ${qty} units of ${symbolUpper} at ${formatINR(price)}/unit!`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/quote
 */
const getStockQuote = async (req, res, next) => {
  try {
    const symbol = req.query.symbol || 'RELIANCE';
    const quote = await marketService.getQuote(symbol);

    return res.status(200).json({
      success: true,
      data: {
        ...quote,
        formattedPrice: formatINR(quote.price),
        formattedChange: quote.change ? `${quote.change > 0 ? '+' : ''}${formatINR(quote.change)}` : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/popular
 */
const getPopularStocks = async (req, res, next) => {
  try {
    const stocks = marketService.getPopularStocks();
    return res.status(200).json({ success: true, data: stocks });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/watchlist
 */
const getWatchlist = async (req, res, next) => {
  try {
    const watchlist = await prisma.marketWatchlist.findMany({
      where: { userId: req.user.id },
      orderBy: { addedAt: 'desc' },
    });

    const withPrices = await Promise.all(
      watchlist.map(async (w) => {
        const quote = await marketService.getQuote(w.symbol);
        return {
          id: w.id,
          symbol: w.symbol,
          name: w.name || quote.name,
          price: quote.price,
          formattedPrice: formatINR(quote.price),
          change: quote.change,
          changePercent: quote.changePercent,
          marketStatus: quote.marketStatus,
          source: quote.source,
        };
      })
    );

    return res.status(200).json({ success: true, data: withPrices });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/market/watchlist
 */
const addToWatchlist = async (req, res, next) => {
  try {
    const { symbol, name } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Symbol is required.' } });
    }

    const item = await prisma.marketWatchlist.upsert({
      where: { userId_symbol: { userId: req.user.id, symbol: symbol.toUpperCase() } },
      update: {},
      create: { userId: req.user.id, symbol: symbol.toUpperCase(), name: name || symbol.toUpperCase() },
    });

    return res.status(201).json({ success: true, data: { ...item, message: `${symbol} added to watchlist!` } });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/market/watchlist/:symbol
 */
const removeFromWatchlist = async (req, res, next) => {
  try {
    await prisma.marketWatchlist.deleteMany({
      where: { userId: req.user.id, symbol: req.params.symbol.toUpperCase() },
    });
    return res.status(200).json({ success: true, data: { message: 'Removed from watchlist.' } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPortfolio, buyInvestment, getStockQuote, getPopularStocks, getWatchlist, addToWatchlist, removeFromWatchlist };
