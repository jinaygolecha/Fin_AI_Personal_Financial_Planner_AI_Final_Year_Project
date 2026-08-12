const axios = require('axios');

/**
 * Market Data Service — Finnhub Provider
 * Owner: Jinay Golecha (jinay_golecha)
 * 
 * Architecture: Frontend → Node API → MarketDataService → Finnhub API
 * Cache: In-memory cache to avoid excessive API calls (5 min TTL)
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

// NSE symbol mapping (Finnhub uses <SYMBOL>:NSE or <SYMBOL>:BSE format)
const SYMBOL_MAP = {
  'RELIANCE': 'RELIANCE:NSE',
  'TCS': 'TCS:NSE',
  'INFY': 'INFY:NSE',
  'HDFCBANK': 'HDFCBANK:NSE',
  'ICICIBANK': 'ICICIBANK:NSE',
  'WIPRO': 'WIPRO:NSE',
  'BAJFINANCE': 'BAJFINANCE:NSE',
  'AXISBANK': 'AXISBANK:NSE',
  'KOTAKBANK': 'KOTAKBANK:NSE',
  'LT': 'LT:NSE',
  'SBIN': 'SBIN:NSE',
  'ADANIENT': 'ADANIENT:NSE',
  'TATAMOTORS': 'TATAMOTORS:NSE',
  'TATASTEEL': 'TATASTEEL:NSE',
  'HINDALCO': 'HINDALCO:NSE',
  // Crypto (Finnhub uses BINANCE: prefix)
  'BTCUSDT': 'BINANCE:BTCUSDT',
  'ETHUSDT': 'BINANCE:ETHUSDT',
};

// Reference prices in INR (fallback when API is not configured / offline)
const REFERENCE_PRICES = {
  'RELIANCE': { price: 2485.30, name: 'Reliance Industries', exchange: 'NSE' },
  'TCS': { price: 3721.45, name: 'Tata Consultancy Services', exchange: 'NSE' },
  'INFY': { price: 1654.80, name: 'Infosys Limited', exchange: 'NSE' },
  'HDFCBANK': { price: 1534.20, name: 'HDFC Bank Ltd', exchange: 'NSE' },
  'ICICIBANK': { price: 1124.60, name: 'ICICI Bank Ltd', exchange: 'NSE' },
  'WIPRO': { price: 312.45, name: 'Wipro Limited', exchange: 'NSE' },
  'BAJFINANCE': { price: 6820.10, name: 'Bajaj Finance Ltd', exchange: 'NSE' },
  'AXISBANK': { price: 1098.70, name: 'Axis Bank Ltd', exchange: 'NSE' },
  'KOTAKBANK': { price: 1834.55, name: 'Kotak Mahindra Bank', exchange: 'NSE' },
  'SBIN': { price: 752.30, name: 'State Bank of India', exchange: 'NSE' },
  'LT': { price: 3456.90, name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
  'GOLD': { price: 62500, name: 'Gold (per gram, 24K)', exchange: 'MCX' },
  'SILVER': { price: 750, name: 'Silver (per gram)', exchange: 'MCX' },
  'BTCUSDT': { price: 5800000, name: 'Bitcoin', exchange: 'CRYPTO' },
  'ETHUSDT': { price: 310000, name: 'Ethereum', exchange: 'CRYPTO' },
};

/**
 * Check if market is currently open (NSE: Mon-Fri 9:15AM-3:30PM IST)
 */
const isMarketOpen = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay(); // 0=Sun, 6=Sat
  const hour = ist.getHours();
  const minute = ist.getMinutes();
  const timeInMins = hour * 60 + minute;

  // Market hours: 9:15 AM (555 mins) to 3:30 PM (930 mins), Mon-Fri
  return day >= 1 && day <= 5 && timeInMins >= 555 && timeInMins <= 930;
};

/**
 * Get timestamp formatted for IST
 */
const getISTTimestamp = () => {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Fetch live quote from Finnhub
 */
const fetchFromFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey || apiKey === 'YOUR_FINNHUB_API_KEY') {
    return null; // Fallback to reference prices
  }

  const finnhubSymbol = SYMBOL_MAP[symbol] || `${symbol}:NSE`;

  try {
    const response = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: finnhubSymbol, token: apiKey },
      timeout: 5000,
    });

    const data = response.data;
    if (!data || data.c === 0) return null;

    return {
      price: data.c, // Current price
      open: data.o,
      high: data.h,
      low: data.l,
      previousClose: data.pc,
      change: data.d,
      changePercent: data.dp,
    };
  } catch (err) {
    console.error(`[MarketService] Finnhub error for ${symbol}:`, err.message);
    return null;
  }
};

/**
 * Get stock quote with cache
 */
const getQuote = async (symbol) => {
  const upperSymbol = symbol.toUpperCase().trim();
  const now = Date.now();

  // Check cache
  if (cache.has(upperSymbol)) {
    const cached = cache.get(upperSymbol);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, source: 'CACHED' };
    }
  }

  // Try live data
  let liveData = await fetchFromFinnhub(upperSymbol);

  const reference = REFERENCE_PRICES[upperSymbol] || { price: 0, name: upperSymbol, exchange: 'NSE' };
  const marketStatus = isMarketOpen() ? 'LIVE' : 'MARKET CLOSED';
  const timestamp = getISTTimestamp();

  let result;
  if (liveData) {
    result = {
      symbol: upperSymbol,
      name: reference.name,
      price: liveData.price,
      open: liveData.open,
      high: liveData.high,
      low: liveData.low,
      previousClose: liveData.previousClose,
      change: liveData.change,
      changePercent: liveData.changePercent,
      exchange: reference.exchange || 'NSE',
      marketStatus,
      source: 'LIVE',
      timestamp,
    };
  } else {
    // Use reference price with DELAYED label
    result = {
      symbol: upperSymbol,
      name: reference.name,
      price: reference.price,
      open: null,
      high: null,
      low: null,
      previousClose: null,
      change: null,
      changePercent: null,
      exchange: reference.exchange || 'NSE',
      marketStatus: 'DELAYED',
      source: 'REFERENCE',
      note: 'Live market data not available. Configure FINNHUB_API_KEY for real-time prices.',
      timestamp,
    };
  }

  // Store in cache
  cache.set(upperSymbol, { data: result, timestamp: now });
  return result;
};

/**
 * Get multiple quotes at once
 */
const getMultipleQuotes = async (symbols) => {
  const results = await Promise.all(symbols.map((s) => getQuote(s)));
  return results;
};

/**
 * Get popular Indian stocks list
 */
const getPopularStocks = () => {
  return Object.entries(REFERENCE_PRICES)
    .filter(([k]) => !['BTCUSDT', 'ETHUSDT'].includes(k))
    .map(([symbol, data]) => ({
      symbol,
      name: data.name,
      exchange: data.exchange,
    }));
};

module.exports = { getQuote, getMultipleQuotes, getPopularStocks, isMarketOpen };
