const prisma = require('../config/database');
const marketService = require('../services/marketService');
const { formatINR } = require('../utils/inr');

/**
 * Investments & Real-Time Market Controller
 * Owner: Jinay Golecha (jinay_golecha)
 */

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

    const metals = await marketService.getPreciousMetals();
    const gold24k = metals.gold.karat24.perGram;
    const gold22k = metals.gold.karat22.perGram;
    const silverGram = metals.silver.perGram;

    let totalInvested = 0;
    let currentPortfolioValue = 0;
    const items = [];

    for (const inv of portfolio.investments) {
      const qty = parseFloat(inv.quantity);
      const avgBuy = parseFloat(inv.averageBuyPrice);
      const costBasis = qty * avgBuy;

      let currPrice = avgBuy;
      let quoteName = inv.name || inv.symbol;
      let marketStatus = 'LIVE';
      let timestamp = metals.timestamp;
      let source = 'LIVE';

      if (inv.assetType === 'GOLD' || inv.symbol.toUpperCase().includes('GOLD')) {
        currPrice = inv.symbol.includes('22K') ? gold22k : gold24k;
        quoteName = inv.name || (inv.symbol.includes('22K') ? 'Gold 22K (Physical/SGB)' : 'Gold 24K (99.9% Pure)');
        marketStatus = metals.marketStatus;
      } else if (inv.assetType === 'SILVER' || inv.symbol.toUpperCase().includes('SILVER')) {
        currPrice = silverGram;
        quoteName = inv.name || 'Silver (99.9% Pure)';
        marketStatus = metals.marketStatus;
      } else {
        const quote = await marketService.getQuote(inv.symbol);
        currPrice = quote.price;
        quoteName = inv.name || quote.name || inv.symbol;
        marketStatus = quote.marketStatus;
        timestamp = quote.timestamp;
        source = quote.source;
      }

      const currVal = qty * currPrice;
      const pnl = currVal - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      totalInvested += costBasis;
      currentPortfolioValue += currVal;

      items.push({
        id: inv.id,
        symbol: inv.symbol,
        name: quoteName,
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
        marketStatus,
        timestamp,
        source,
      });
    }

    // Update portfolio totals in DB
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

    // Upsert investment
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
 * GET /api/v1/market/history
 */
const getStockHistory = async (req, res, next) => {
  try {
    const symbol = req.query.symbol || 'RELIANCE';
    const timeframe = req.query.timeframe || '1M';
    const history = await marketService.getStockHistory(symbol, timeframe);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/search
 */
const searchStocks = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const results = marketService.searchStocks(query);
    return res.status(200).json({ success: true, data: results });
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
 * GET /api/v1/market/metals
 */
const getMetals = async (req, res, next) => {
  try {
    const data = await marketService.getPreciousMetals();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/gold
 */
const getGold = async (req, res, next) => {
  try {
    const metals = await marketService.getPreciousMetals();
    return res.status(200).json({
      success: true,
      data: {
        ...metals.gold,
        marketStatus: metals.marketStatus,
        source: metals.source,
        timestamp: metals.timestamp,
        provider: metals.provider,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/market/silver
 */
const getSilver = async (req, res, next) => {
  try {
    const metals = await marketService.getPreciousMetals();
    return res.status(200).json({
      success: true,
      data: {
        ...metals.silver,
        marketStatus: metals.marketStatus,
        source: metals.source,
        timestamp: metals.timestamp,
        provider: metals.provider,
      },
    });
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

/**
 * GET /api/v1/investments
 */
const getInvestments = async (req, res, next) => {
  return getPortfolio(req, res, next);
};

/**
 * PATCH /api/v1/investments/:id
 */
const updateInvestment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const portfolio = await prisma.portfolio.findUnique({ where: { userId } });
    if (!portfolio) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const investment = await prisma.investment.findFirst({
      where: { id: req.params.id, portfolioId: portfolio.id },
    });

    if (!investment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Investment not found.' } });
    }

    const { quantity, averageBuyPrice, name, assetType } = req.body;
    const updated = await prisma.investment.update({
      where: { id: req.params.id },
      data: {
        ...(quantity !== undefined && { quantity: parseFloat(quantity) }),
        ...(averageBuyPrice !== undefined && { averageBuyPrice: parseFloat(averageBuyPrice) }),
        ...(name && { name: name.trim() }),
        ...(assetType && { assetType }),
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        ...updated,
        formattedBuyPrice: formatINR(updated.averageBuyPrice),
        message: 'Investment updated successfully.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/investments/:id
 */
const deleteInvestment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const portfolio = await prisma.portfolio.findUnique({ where: { userId } });
    if (!portfolio) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Portfolio not found.' } });
    }

    const investment = await prisma.investment.findFirst({
      where: { id: req.params.id, portfolioId: portfolio.id },
    });

    if (!investment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Investment not found.' } });
    }

    await prisma.investment.delete({ where: { id: req.params.id } });

    return res.status(200).json({
      success: true,
      data: { message: `Investment in ${investment.symbol} sold/deleted.` },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPortfolio,
  getInvestments,
  buyInvestment,
  updateInvestment,
  deleteInvestment,
  getStockQuote,
  getStockHistory,
  searchStocks,
  getPopularStocks,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getMetals,
  getGold,
  getSilver,
};
