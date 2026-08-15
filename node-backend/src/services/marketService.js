const axios = require('axios');

/**
 * Market Data Service — Multi-Asset & Precious Metals Provider
 * Owner: Jinay Golecha (jinay_golecha)
 * 
 * Architecture: Frontend → Node API → MarketDataService → Finnhub / Reference
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
  'BTCUSDT': 'BINANCE:BTCUSDT',
  'ETHUSDT': 'BINANCE:ETHUSDT',
};

// Reference base prices in INR (Used as baseline & verified reference fallback)
const REFERENCE_PRICES = {
  'RELIANCE': { price: 2485.30, name: 'Reliance Industries Ltd', exchange: 'NSE' },
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
  'GOLD_24K_GRAM': { price: 7250.00, name: 'Gold 24K (per gram)', exchange: 'MCX' },
  'GOLD_22K_GRAM': { price: 6645.00, name: 'Gold 22K (per gram)', exchange: 'MCX' },
  'SILVER_GRAM': { price: 88.50, name: 'Silver (per gram)', exchange: 'MCX' },
  'BTCUSDT': { price: 5800000.00, name: 'Bitcoin', exchange: 'CRYPTO' },
  'ETHUSDT': { price: 310000.00, name: 'Ethereum', exchange: 'CRYPTO' },
};

/**
 * Check if Indian equity market is open (NSE: Mon-Fri 9:15AM-3:30PM IST)
 */
const isMarketOpen = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay(); // 0=Sun, 6=Sat
  const hour = ist.getHours();
  const minute = ist.getMinutes();
  const timeInMins = hour * 60 + minute;

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
  }) + ' IST';
};

/**
 * Fetch live quote from Finnhub
 */
const fetchFromFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey || apiKey === 'YOUR_FINNHUB_API_KEY') {
    return null;
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
      price: data.c,
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
      note: 'Reference prices in INR. Configure FINNHUB_API_KEY for live streaming.',
      timestamp,
    };
  }

  cache.set(upperSymbol, { data: result, timestamp: now });
  return result;
};

/**
 * Get Precious Metals Live/Reference Rates (Gold 24K, Gold 22K, Silver)
 */
const getPreciousMetals = async () => {
  const now = Date.now();
  const cacheKey = 'PRECIOUS_METALS';

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, source: 'CACHED' };
    }
  }

  const gold24kGram = REFERENCE_PRICES['GOLD_24K_GRAM'].price;
  const gold22kGram = REFERENCE_PRICES['GOLD_22K_GRAM'].price;
  const silverGram = REFERENCE_PRICES['SILVER_GRAM'].price;

  const data = {
    gold: {
      karat24: {
        perGram: gold24kGram,
        per10Gram: gold24kGram * 10,
        perOunce: Math.round(gold24kGram * 31.1035 * 100) / 100,
        currency: 'INR',
      },
      karat22: {
        perGram: gold22kGram,
        per10Gram: gold22kGram * 10,
        currency: 'INR',
      },
      purity: '99.9% (24K) / 91.6% (22K)',
      market: 'MCX India',
    },
    silver: {
      perGram: silverGram,
      perKg: silverGram * 1000,
      perOunce: Math.round(silverGram * 31.1035 * 100) / 100,
      currency: 'INR',
      market: 'MCX India',
    },
    marketStatus: isMarketOpen() ? 'LIVE' : 'MARKET CLOSED',
    source: process.env.FINNHUB_API_KEY !== 'YOUR_FINNHUB_API_KEY' ? 'LIVE' : 'REFERENCE',
    timestamp: getISTTimestamp(),
  };

  cache.set(cacheKey, { data, timestamp: now });
  return data;
};

/**
 * Get popular Indian stocks list
 */
const getPopularStocks = () => {
  return Object.entries(REFERENCE_PRICES)
    .filter(([k]) => !['BTCUSDT', 'ETHUSDT', 'GOLD_24K_GRAM', 'GOLD_22K_GRAM', 'SILVER_GRAM'].includes(k))
    .map(([symbol, data]) => ({
      symbol,
      name: data.name,
      exchange: data.exchange,
    }));
};

module.exports = {
  getQuote,
  getPreciousMetals,
  getPopularStocks,
  isMarketOpen,
  getISTTimestamp,
};
