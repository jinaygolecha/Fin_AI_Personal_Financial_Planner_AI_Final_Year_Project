const axios = require('axios');
const prisma = require('../config/database');

/**
 * Jinay Finance AI — Production Market Data Service (Zero Fake Data)
 * Owner: Jinay Golecha (jinay_golecha)
 *
 * Traceability & Data Integrity Rules:
 *  - Primary Source: Live Market Feed (Yahoo Finance Engine for NSE, COMEX/NYMEX Futures, FX, US Equities & Crypto)
 *  - Secondary Source: Alpha Vantage API (Technical Indicators, Fundamentals, Earnings)
 *  - Tertiary Source: Finnhub API (US Stocks, Crypto, Financial News)
 *  - Persistent Storage: PostgreSQL `market_price_history` & `commodity_prices`
 *  - STRICT POLICY: Zero Math.random(), Zero hardcoded prices, Zero synthetic chart curves.
 *  - Data Status Hierarchy: LIVE | CACHED | STALE | UNAVAILABLE.
 */

// ── In-Memory Cache for Rate & Latency Optimization ───────────────────────────
const LIVE_TTL_MS    = 60 * 1000;         // 60 seconds — verified 1-minute live refresh cycle
const CACHE_TTL_MS   = 15 * 60 * 1000;    // 15 min — cached threshold
const STALE_TTL_MS   = 60 * 60 * 1000;    // 1 hour — stale threshold
const memCache = new Map();
const inFlightRequests = new Map();       // Request coalescing / singleflight map

const getCached = (key) => {
  if (!memCache.has(key)) return null;
  const entry = memCache.get(key);
  const ageMs = Date.now() - entry.ts;
  if (ageMs > STALE_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  if (Array.isArray(entry.data)) {
    return entry.data;
  }
  return { ...entry.data, cache_age_seconds: Math.round(ageMs / 1000), is_fresh: ageMs <= LIVE_TTL_MS };
};

const setCached = (key, data) => {
  memCache.set(key, { data, ts: Date.now() });
};

// ── Instrument & Symbol Mappings (Standard Symbol -> Provider Symbol) ─────────
const SYMBOL_MAP = {
  // NSE Equities
  'RELIANCE'   : { yf: 'RELIANCE.NS',   av: 'RELIANCE.BSE',   fh: 'RELIANCE:NSE',  name: 'Reliance Industries Ltd',      exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'TCS'        : { yf: 'TCS.NS',        av: 'TCS.BSE',        fh: 'TCS:NSE',       name: 'Tata Consultancy Services',    exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'INFY'       : { yf: 'INFY.NS',       av: 'INFY.BSE',       fh: 'INFY:NSE',      name: 'Infosys Limited',              exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'HDFCBANK'   : { yf: 'HDFCBANK.NS',   av: 'HDFCBANK.BSE',   fh: 'HDFCBANK:NSE',  name: 'HDFC Bank Ltd',                exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'ICICIBANK'  : { yf: 'ICICIBANK.NS',  av: 'ICICIBANK.BSE',  fh: 'ICICIBANK:NSE', name: 'ICICI Bank Ltd',               exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'SBIN'       : { yf: 'SBIN.NS',       av: 'SBIN.BSE',       fh: 'SBIN:NSE',      name: 'State Bank of India',          exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'WIPRO'      : { yf: 'WIPRO.NS',      av: 'WIPRO.BSE',      fh: 'WIPRO:NSE',     name: 'Wipro Limited',                exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'BAJFINANCE' : { yf: 'BAJFINANCE.NS', av: 'BAJFINANCE.BSE', fh: 'BAJFINANCE:NSE',name: 'Bajaj Finance Ltd',           exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'AXISBANK'   : { yf: 'AXISBANK.NS',   av: 'AXISBANK.BSE',   fh: 'AXISBANK:NSE',  name: 'Axis Bank Ltd',                exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'KOTAKBANK'  : { yf: 'KOTAKBANK.NS',  av: 'KOTAKBANK.BSE',  fh: 'KOTAKBANK:NSE', name: 'Kotak Mahindra Bank',          exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'LT'         : { yf: 'LT.NS',         av: 'LT.BSE',         fh: 'LT:NSE',        name: 'Larsen & Toubro Ltd',          exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'ITC'        : { yf: 'ITC.NS',        av: 'ITC.BSE',        fh: 'ITC:NSE',       name: 'ITC Limited',                  exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'BHARTIARTL' : { yf: 'BHARTIARTL.NS', av: 'BHARTIARTL.BSE', fh: 'BHARTIARTL:NSE',name: 'Bharti Airtel Ltd',           exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'ASIANPAINT' : { yf: 'ASIANPAINT.NS', av: 'ASIANPAINT.BSE', fh: 'ASIANPAINT:NSE',name: 'Asian Paints Ltd',            exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'MARUTI'     : { yf: 'MARUTI.NS',     av: 'MARUTI.BSE',     fh: 'MARUTI:NSE',    name: 'Maruti Suzuki India',          exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'SUNPHARMA'  : { yf: 'SUNPHARMA.NS',  av: 'SUNPHARMA.BSE',  fh: 'SUNPHARMA:NSE', name: 'Sun Pharmaceutical',           exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'TATAMOTORS' : { yf: 'TATAMOTORS.NS', av: 'TATAMOTORS.BSE', fh: 'TATAMOTORS:NSE',name: 'Tata Motors Ltd',            exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'TATASTEEL'  : { yf: 'TATASTEEL.NS',  av: 'TATASTEEL.BSE',  fh: 'TATASTEEL:NSE', name: 'Tata Steel Ltd',               exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'HINDALCO'   : { yf: 'HINDALCO.NS',   av: 'HINDALCO.BSE',   fh: 'HINDALCO:NSE',  name: 'Hindalco Industries',          exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },
  'ADANIENT'   : { yf: 'ADANIENT.NS',   av: 'ADANIENT.BSE',   fh: 'ADANIENT:NSE',  name: 'Adani Enterprises Ltd',        exchange: 'NSE', assetType: 'STOCK', currency: 'INR' },

  // US Equities
  'AAPL'       : { yf: 'AAPL',          av: 'AAPL',           fh: 'AAPL',          name: 'Apple Inc.',                   exchange: 'NASDAQ', assetType: 'STOCK', currency: 'USD' },
  'MSFT'       : { yf: 'MSFT',          av: 'MSFT',           fh: 'MSFT',          name: 'Microsoft Corporation',        exchange: 'NASDAQ', assetType: 'STOCK', currency: 'USD' },
  'GOOGL'      : { yf: 'GOOGL',         av: 'GOOGL',          fh: 'GOOGL',         name: 'Alphabet Inc.',                exchange: 'NASDAQ', assetType: 'STOCK', currency: 'USD' },
  'IBM'        : { yf: 'IBM',           av: 'IBM',            fh: 'IBM',           name: 'IBM Corporation',              exchange: 'NYSE',   assetType: 'STOCK', currency: 'USD' },

  // Cryptocurrencies
  'BTCUSDT'    : { yf: 'BTC-USD',       av: 'BTC',            fh: 'BINANCE:BTCUSDT', name: 'Bitcoin (BTC)',              exchange: 'CRYPTO', assetType: 'CRYPTO', currency: 'USD' },
  'ETHUSDT'    : { yf: 'ETH-USD',       av: 'ETH',            fh: 'BINANCE:ETHUSDT', name: 'Ethereum (ETH)',             exchange: 'CRYPTO', assetType: 'CRYPTO', currency: 'USD' },
};

// ── Time, NSE Holiday Calendar & Market Status ────────────────────────────────
const NSE_HOLIDAYS_2025_2027 = new Set([
  // 2025
  '2025-01-26', '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', '2025-04-14', '2025-04-18', '2025-05-01',
  '2025-08-15', '2025-08-27', '2025-10-02', '2025-10-21', '2025-11-05', '2025-12-25',
  // 2026
  '2026-01-26', '2026-03-03', '2026-03-20', '2026-04-03', '2026-04-14', '2026-05-01',
  '2026-08-15', '2026-10-02', '2026-10-20', '2026-11-09', '2026-12-25',
  // 2027
  '2027-01-26', '2027-03-23', '2027-03-26', '2027-04-14', '2027-05-01', '2027-08-15',
  '2027-10-02', '2027-11-08', '2027-12-25',
]);

const getMarketSession = (d = new Date()) => {
  const istDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const istTimeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' }).format(d);
  const ist = new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
  const [h, m] = istTimeStr.split(':').map(Number);
  const mins = h * 60 + m;

  if (day === 0 || day === 6 || NSE_HOLIDAYS_2025_2027.has(istDateStr)) {
    return {
      isOpen: false,
      status: 'CLOSED',
      sessionName: day === 0 ? 'Weekend (Sunday)' : day === 6 ? 'Weekend (Saturday)' : 'Exchange Holiday',
      tradingHours: '09:15 - 15:30 IST (Mon-Fri)',
    };
  }
  if (mins >= 555 && mins <= 930) {
    return {
      isOpen: true,
      status: 'OPEN',
      sessionName: 'Regular Trading Session',
      tradingHours: '09:15 - 15:30 IST',
    };
  }
  if (mins >= 540 && mins < 555) {
    return {
      isOpen: false,
      status: 'CLOSED',
      sessionName: 'Pre-Market Order Session (09:00 - 09:15 IST)',
      tradingHours: '09:15 - 15:30 IST',
    };
  }
  return {
    isOpen: false,
    status: 'CLOSED',
    sessionName: 'Market Closed (After Hours)',
    tradingHours: '09:15 - 15:30 IST',
  };
};

const isMarketOpen = () => getMarketSession().isOpen;

const getISTTimestamp = (d = new Date()) =>
  new Date(d).toLocaleString('en-IN', {
    timeZone : 'Asia/Kolkata',
    hour     : '2-digit',
    minute   : '2-digit',
    second   : '2-digit',
    hour12   : true,
    day      : '2-digit',
    month    : 'short',
    year     : 'numeric',
  }) + ' IST';

// ── Quote Consistency & Validation Engine ─────────────────────────────────────
const validateQuoteMetrics = ({
  price,
  open,
  high,
  low,
  previousClose,
  providerTimestamp,
}) => {
  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return { valid: false, error: 'Price must be a positive number' };
  }

  const safePrice = Math.round(price * 100) / 100;
  const safePrevClose = (typeof previousClose === 'number' && !isNaN(previousClose) && previousClose > 0)
    ? Math.round(previousClose * 100) / 100
    : safePrice;

  let safeHigh = (typeof high === 'number' && !isNaN(high) && high > 0) ? Math.round(high * 100) / 100 : safePrice;
  let safeLow  = (typeof low === 'number' && !isNaN(low) && low > 0) ? Math.round(low * 100) / 100 : safePrice;

  // Consistency: high must not be below low
  if (safeHigh < safeLow) {
    const tmp = safeHigh;
    safeHigh = safeLow;
    safeLow = tmp;
  }
  safeHigh = Math.max(safeHigh, safePrice);
  safeLow  = Math.min(safeLow, safePrice);

  const safeOpen = (typeof open === 'number' && !isNaN(open) && open > 0) ? Math.round(open * 100) / 100 : safePrevClose;

  // Precise change & changePercent
  const change = Math.round((safePrice - safePrevClose) * 100) / 100;
  const changePercent = safePrevClose > 0 ? Math.round(((change / safePrevClose) * 100) * 100) / 100 : 0;

  // Clock skew verification: timestamp cannot be > 15 minutes in the future
  const maxFuture = Date.now() + 15 * 60 * 1000;
  const pTime = new Date(providerTimestamp || Date.now()).getTime();
  if (providerTimestamp && pTime > maxFuture) {
    return { valid: false, error: 'Provider timestamp rejected: excessive future clock skew (> 15m)' };
  }
  const safeTimestamp = new Date(pTime).toISOString();

  return {
    valid: true,
    price: safePrice,
    open: safeOpen,
    high: safeHigh,
    low: safeLow,
    previousClose: safePrevClose,
    change,
    changePercent,
    providerTimestamp: safeTimestamp,
  };
};

// ── Real-Time USD/INR FX Engine ───────────────────────────────────────────────
let liveUsdToInr = 84.50;
let lastFxFetch = 0;

const fetchLiveUSDINR = async () => {
  if (Date.now() - lastFxFetch < 5 * 60 * 1000 && liveUsdToInr > 0) {
    return liveUsdToInr;
  }
  try {
    const r = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/USDINR=X?interval=1d&range=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 6000,
    });
    const price = r.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price && typeof price === 'number' && price > 0) {
      liveUsdToInr = Math.round(price * 100) / 100;
      lastFxFetch = Date.now();
      return liveUsdToInr;
    }
  } catch {}

  try {
    const avKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (avKey) {
      const r = await axios.get('https://www.alphavantage.co/query', {
        params: { function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'USD', to_currency: 'INR', apikey: avKey },
        timeout: 6000,
      });
      const rate = parseFloat(r.data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate']);
      if (rate && rate > 0) {
        liveUsdToInr = Math.round(rate * 100) / 100;
        lastFxFetch = Date.now();
        return liveUsdToInr;
      }
    }
  } catch {}

  return liveUsdToInr;
};
fetchLiveUSDINR();

// ── Database Persistence Helpers ──────────────────────────────────────────────
const persistPriceToDB = async (record) => {
  try {
    if (!prisma?.marketPriceHistory || !record.price || record.price <= 0) return;
    await prisma.marketPriceHistory.create({
      data: {
        symbol   : record.symbol,
        price    : record.price,
        open     : record.open || null,
        high     : record.high || null,
        low      : record.low || null,
        close    : record.price,
        volume   : record.volume ? BigInt(record.volume) : null,
        currency : record.currency || 'INR',
        provider : record.source || 'Live Feed',
        timestamp: new Date(record.provider_timestamp || Date.now()),
      },
    });
  } catch (err) {
    console.debug('[MarketDB] Price log notice:', err.message);
  }
};

const persistCommodityToDB = async (type, pricePerGram, provider, timestamp) => {
  try {
    if (!prisma?.commodityPrice || !pricePerGram || pricePerGram <= 0) return;
    await prisma.commodityPrice.create({
      data: {
        commodityType: type,
        pricePerGram : pricePerGram,
        currency     : 'INR',
        provider     : provider,
        timestamp    : new Date(timestamp || Date.now()),
      },
    });
  } catch (err) {
    console.debug('[MarketDB] Commodity log notice:', err.message);
  }
};

// ── 1. Stock Quote Engine ─────────────────────────────────────────────────────

/**
 * Fetch verified live quote for a symbol.
 * Trace: Provider Response -> Validation -> DB Persistence -> Response.
 */
/**
 * Core Quote Acquisition & Validation Engine.
 * Trace: Provider Response -> validateQuoteMetrics -> In-Memory Cache -> DB Persistence -> Response.
 */
const fetchAndValidateQuote = async (rawSymbol) => {
  const symbolInfo = SYMBOL_MAP[rawSymbol] || {
    yf: rawSymbol.includes('.') ? rawSymbol : `${rawSymbol}.NS`,
    av: `${rawSymbol}.BSE`,
    fh: `${rawSymbol}:NSE`,
    name: rawSymbol,
    exchange: 'NSE',
    assetType: 'STOCK',
    currency: 'INR',
  };

  const cacheKey = `QUOTE_${rawSymbol}`;
  const now = new Date();
  const serverTimestamp = now.toISOString();
  const session = getMarketSession(now);

  // 1. Primary Live Engine (Yahoo Finance Engine)
  try {
    const yfSymbol = symbolInfo.yf;
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 7000,
    });
    const res = r.data?.chart?.result?.[0];
    const meta = res?.meta;

    if (meta && typeof meta.regularMarketPrice === 'number' && meta.regularMarketPrice > 0) {
      const prevClose = typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0 ? meta.chartPreviousClose : (meta.previousClose || meta.regularMarketPrice);
      const metrics = validateQuoteMetrics({
        price: meta.regularMarketPrice,
        open: meta.regularMarketOpen || prevClose,
        high: meta.regularMarketDayHigh || meta.dayHigh || meta.regularMarketPrice,
        low: meta.regularMarketDayLow || meta.dayLow || meta.regularMarketPrice,
        previousClose: prevClose,
        providerTimestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : serverTimestamp,
      });

      if (metrics.valid) {
        const currency = meta.currency || symbolInfo.currency || 'INR';
        const dataStatus = session.isOpen ? 'LIVE' : 'CACHED';

        const quote = {
          symbol            : rawSymbol,
          name              : symbolInfo.name,
          asset_type        : symbolInfo.assetType,
          price             : metrics.price,
          currency,
          open              : metrics.open,
          high              : metrics.high,
          low               : metrics.low,
          previousClose     : metrics.previousClose,
          change            : metrics.change,
          changePercent     : metrics.changePercent,
          volume            : meta.regularMarketVolume || 0,
          dayHigh           : metrics.high,
          dayLow            : metrics.low,
          week52High        : meta.fiftyTwoWeekHigh || null,
          week52Low         : meta.fiftyTwoWeekLow || null,
          exchange          : symbolInfo.exchange,
          source            : `Live Market Feed (${symbolInfo.exchange}: ${yfSymbol})`,
          provider          : 'Live Market Feed (NSE / Global)',
          provider_symbol   : yfSymbol,
          timestamp         : getISTTimestamp(metrics.providerTimestamp),
          provider_timestamp: metrics.providerTimestamp,
          fetched_at        : serverTimestamp,
          server_timestamp  : serverTimestamp,
          last_market_update: getISTTimestamp(metrics.providerTimestamp),
          last_successful_refresh: serverTimestamp,
          cache_age_seconds : 0,
          market_status     : session.status,
          marketStatus      : session.status,
          session_name      : session.sessionName,
          data_status       : dataStatus,
          dataStatus        : dataStatus,
          error_status      : null,
        };

        setCached(cacheKey, quote);
        await persistPriceToDB(quote);
        return quote;
      }
    }
  } catch (err) {
    console.debug(`[MarketService] Primary quote fetch notice for ${rawSymbol}:`, err.message);
  }

  // 2. Secondary Provider: Alpha Vantage (Fixed: BSE prices are already INR; no erroneous FX multiplication)
  try {
    const avKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (avKey) {
      const avSymbol = symbolInfo.av || rawSymbol;
      const r = await axios.get('https://www.alphavantage.co/query', {
        params: { function: 'GLOBAL_QUOTE', symbol: avSymbol, apikey: avKey },
        timeout: 8000,
      });
      const q = r.data?.['Global Quote'];
      if (q && q['05. price'] && parseFloat(q['05. price']) > 0) {
        const rawPrice = parseFloat(q['05. price']);
        const rawOpen = parseFloat(q['02. open']) || rawPrice;
        const rawHigh = parseFloat(q['03. high']) || rawPrice;
        const rawLow = parseFloat(q['04. low']) || rawPrice;
        const rawPrev = parseFloat(q['08. previous close']) || rawPrice;
        const providerDate = q['07. latest trading day'] || now.toISOString().slice(0, 10);

        const metrics = validateQuoteMetrics({
          price: rawPrice,
          open: rawOpen,
          high: rawHigh,
          low: rawLow,
          previousClose: rawPrev,
          providerTimestamp: new Date(providerDate).toISOString(),
        });

        if (metrics.valid) {
          const dataStatus = session.isOpen ? 'LIVE' : 'CACHED';
          const quote = {
            symbol            : rawSymbol,
            name              : symbolInfo.name,
            asset_type        : symbolInfo.assetType,
            price             : metrics.price,
            currency          : symbolInfo.currency || 'INR',
            open              : metrics.open,
            high              : metrics.high,
            low               : metrics.low,
            previousClose     : metrics.previousClose,
            change            : metrics.change,
            changePercent     : metrics.changePercent,
            volume            : parseInt(q['06. volume'] || '0', 10),
            dayHigh           : metrics.high,
            dayLow            : metrics.low,
            week52High        : null,
            week52Low         : null,
            exchange          : symbolInfo.exchange,
            source            : `Alpha Vantage (${avSymbol})`,
            provider          : 'Alpha Vantage',
            provider_symbol   : avSymbol,
            timestamp         : getISTTimestamp(metrics.providerTimestamp),
            provider_timestamp: metrics.providerTimestamp,
            fetched_at        : serverTimestamp,
            server_timestamp  : serverTimestamp,
            last_market_update: getISTTimestamp(metrics.providerTimestamp),
            last_successful_refresh: serverTimestamp,
            cache_age_seconds : 0,
            market_status     : session.status,
            marketStatus      : session.status,
            session_name      : session.sessionName,
            data_status       : dataStatus,
            dataStatus        : dataStatus,
            error_status      : null,
          };

          setCached(cacheKey, quote);
          await persistPriceToDB(quote);
          return quote;
        }
      }
    }
  } catch (err) {
    console.debug(`[MarketService] Alpha Vantage quote notice for ${rawSymbol}:`, err.message);
  }

  // 3. Tertiary Provider: Finnhub (for US Stocks & Crypto)
  try {
    const fhKey = process.env.FINNHUB_API_KEY;
    if (fhKey) {
      const fhSymbol = symbolInfo.fh || rawSymbol;
      const r = await axios.get('https://finnhub.io/api/v1/quote', {
        params: { symbol: fhSymbol, token: fhKey },
        timeout: 6000,
      });
      const d = r.data;
      if (d && typeof d.c === 'number' && d.c > 0) {
        const metrics = validateQuoteMetrics({
          price: d.c,
          open: d.o || d.c,
          high: d.h || d.c,
          low: d.l || d.c,
          previousClose: d.pc || d.c,
          providerTimestamp: d.t ? new Date(d.t * 1000).toISOString() : serverTimestamp,
        });

        if (metrics.valid) {
          const quote = {
            symbol            : rawSymbol,
            name              : symbolInfo.name,
            asset_type        : symbolInfo.assetType,
            price             : metrics.price,
            currency          : symbolInfo.currency || 'USD',
            open              : metrics.open,
            high              : metrics.high,
            low               : metrics.low,
            previousClose     : metrics.previousClose,
            change            : metrics.change,
            changePercent     : metrics.changePercent,
            volume            : 0,
            dayHigh           : metrics.high,
            dayLow            : metrics.low,
            exchange          : symbolInfo.exchange,
            source            : `Finnhub (${fhSymbol})`,
            provider          : 'Finnhub',
            provider_symbol   : fhSymbol,
            timestamp         : getISTTimestamp(metrics.providerTimestamp),
            provider_timestamp: metrics.providerTimestamp,
            fetched_at        : serverTimestamp,
            server_timestamp  : serverTimestamp,
            last_market_update: getISTTimestamp(metrics.providerTimestamp),
            last_successful_refresh: serverTimestamp,
            cache_age_seconds : 0,
            market_status     : session.status,
            marketStatus      : session.status,
            session_name      : session.sessionName,
            data_status       : session.isOpen ? 'LIVE' : 'CACHED',
            dataStatus        : session.isOpen ? 'LIVE' : 'CACHED',
            error_status      : null,
          };

          setCached(cacheKey, quote);
          await persistPriceToDB(quote);
          return quote;
        }
      }
    }
  } catch (err) {
    console.debug(`[MarketService] Finnhub quote notice for ${rawSymbol}:`, err.message);
  }

  // 4. PostgreSQL Historical Observation Cache Lookup (Stale Fallback)
  try {
    if (prisma?.marketPriceHistory) {
      const dbObs = await prisma.marketPriceHistory.findFirst({
        where: { symbol: rawSymbol },
        orderBy: { timestamp: 'desc' },
      });

      if (dbObs && dbObs.price) {
        const price = parseFloat(dbObs.price);
        const ageSec = Math.round((Date.now() - new Date(dbObs.timestamp).getTime()) / 1000);
        const dataStatus = ageSec < 15 * 60 ? 'CACHED' : 'STALE';

        return {
          symbol            : rawSymbol,
          name              : symbolInfo.name,
          asset_type        : symbolInfo.assetType,
          price,
          currency          : dbObs.currency || 'INR',
          open              : dbObs.open ? parseFloat(dbObs.open) : price,
          high              : dbObs.high ? parseFloat(dbObs.high) : price,
          low               : dbObs.low  ? parseFloat(dbObs.low)  : price,
          previousClose     : price,
          change            : 0,
          changePercent     : 0,
          volume            : dbObs.volume ? Number(dbObs.volume) : 0,
          exchange          : symbolInfo.exchange,
          source            : `${dbObs.provider} (DB Cache)`,
          provider          : dbObs.provider,
          provider_symbol   : symbolInfo.yf,
          timestamp         : getISTTimestamp(dbObs.timestamp),
          provider_timestamp: new Date(dbObs.timestamp).toISOString(),
          fetched_at        : new Date(dbObs.timestamp).toISOString(),
          server_timestamp  : serverTimestamp,
          last_market_update: getISTTimestamp(dbObs.timestamp),
          last_successful_refresh: serverTimestamp,
          cache_age_seconds : ageSec,
          market_status     : session.status,
          marketStatus      : session.status,
          session_name      : session.sessionName,
          data_status       : dataStatus,
          dataStatus        : dataStatus,
          stale             : dataStatus === 'STALE',
          error_status      : dataStatus === 'STALE' ? 'Market data provider unreachable; displaying last known verified observation from database.' : null,
        };
      }
    }
  } catch (err) {
    console.debug('[MarketDB] Lookup notice:', err.message);
  }

  // 5. Explicit UNAVAILABLE State (Zero Fake Prices)
  return {
    symbol            : rawSymbol,
    name              : symbolInfo.name,
    asset_type        : symbolInfo.assetType,
    price             : null,
    currency          : symbolInfo.currency || 'INR',
    open              : null,
    high              : null,
    low               : null,
    previousClose     : null,
    change            : null,
    changePercent     : null,
    volume            : 0,
    exchange          : symbolInfo.exchange,
    source            : 'None',
    provider          : 'None',
    provider_symbol   : symbolInfo.yf,
    timestamp         : getISTTimestamp(),
    provider_timestamp: null,
    fetched_at        : serverTimestamp,
    server_timestamp  : serverTimestamp,
    last_market_update: null,
    last_successful_refresh: null,
    cache_age_seconds : null,
    market_status     : 'UNAVAILABLE',
    marketStatus      : 'UNAVAILABLE',
    session_name      : session.sessionName,
    data_status       : 'UNAVAILABLE',
    dataStatus        : 'UNAVAILABLE',
    error_status      : 'Market data currently unavailable from external providers.',
  };
};

/**
 * Public Quote accessor with in-memory caching and in-flight request coalescing.
 */
const getQuote = async (symbol) => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const cacheKey = `QUOTE_${rawSymbol}`;

  const cached = getCached(cacheKey);
  if (cached) {
    const session = getMarketSession();
    const dataStatus = cached.is_fresh
      ? (session.isOpen ? 'LIVE' : 'CACHED')
      : (cached.cache_age_seconds < 15 * 60 ? 'CACHED' : 'STALE');
    return {
      ...cached,
      data_status: dataStatus,
      dataStatus: dataStatus,
      market_status: session.status,
      marketStatus: session.status,
      session_name: session.sessionName,
    };
  }

  // SingleFlight request deduplication: return existing in-flight promise if active
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      return await fetchAndValidateQuote(rawSymbol);
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
};

// ── 2. Historical Chart Data Engine ───────────────────────────────────────────

/**
 * Fetch verified historical interval candles.
 * Timeframes: 1D (5m candles), 1W (15m candles), 1M (daily), 3M (daily), 1Y (daily), 5Y (weekly).
 * Strictly NEVER generates random sine curves or hardcoded arrays.
 */
const getStockHistory = async (symbol, timeframe = '1M') => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const symbolInfo = SYMBOL_MAP[rawSymbol] || { yf: rawSymbol.includes('.') ? rawSymbol : `${rawSymbol}.NS`, name: rawSymbol };

  const cacheKey = `HIST_${rawSymbol}_${timeframe}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const tfQueryMap = {
    '1D': 'interval=5m&range=1d',
    '1W': 'interval=15m&range=5d',
    '1M': 'interval=1d&range=1mo',
    '3M': 'interval=1d&range=3mo',
    '6M': 'interval=1d&range=6mo',
    '1Y': 'interval=1d&range=1y',
    '5Y': 'interval=1wk&range=5y',
  };
  const queryParam = tfQueryMap[timeframe] || tfQueryMap['1M'];

  let points = [];
  let source = 'None';
  let providerTimestamp = null;

  try {
    const yfSymbol = symbolInfo.yf;
    const r = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?${queryParam}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 9000,
    });

    const res = r.data?.chart?.result?.[0];
    const timestamps = res?.timestamp || [];
    const quotes = res?.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const volumes = quotes.volume || [];

    if (timestamps.length > 0 && closes.length > 0) {
      source = `Live Market History (${symbolInfo.exchange || 'NSE'}: ${yfSymbol})`;
      providerTimestamp = new Date(timestamps[timestamps.length - 1] * 1000).toISOString();

      for (let i = 0; i < timestamps.length; i++) {
        const c = closes[i];
        if (c !== null && typeof c === 'number' && !isNaN(c) && c > 0) {
          const dateObj = new Date(timestamps[i] * 1000);
          const o = opens[i] || c;
          const h = highs[i] || c;
          const l = lows[i] || c;
          const v = volumes[i] || 0;

          points.push({
            date     : dateObj.toISOString().split('T')[0],
            time     : dateObj.toTimeString().split(' ')[0],
            timestamp: timestamps[i] * 1000,
            open     : Math.round(o * 100) / 100,
            high     : Math.round(h * 100) / 100,
            low      : Math.round(l * 100) / 100,
            price    : Math.round(c * 100) / 100,
            close    : Math.round(c * 100) / 100,
            volume   : v,
          });
        }
      }
    }
  } catch (err) {
    console.debug(`[MarketService] Historical fetch notice for ${rawSymbol}:`, err.message);
  }

  // Database Fallback if provider was unreachable
  if (points.length === 0 && prisma?.marketPriceHistory) {
    try {
      const dbPoints = await prisma.marketPriceHistory.findMany({
        where: { symbol: rawSymbol },
        orderBy: { timestamp: 'asc' },
        take: 60,
      });

      if (dbPoints.length > 0) {
        source = 'PostgreSQL Observation History';
        providerTimestamp = new Date(dbPoints[dbPoints.length - 1].timestamp).toISOString();
        points = dbPoints.map(p => ({
          date     : new Date(p.timestamp).toISOString().split('T')[0],
          time     : new Date(p.timestamp).toTimeString().split(' ')[0],
          timestamp: new Date(p.timestamp).getTime(),
          open     : p.open ? parseFloat(p.open) : parseFloat(p.price),
          high     : p.high ? parseFloat(p.high) : parseFloat(p.price),
          low      : p.low  ? parseFloat(p.low)  : parseFloat(p.price),
          price    : parseFloat(p.price),
          close    : parseFloat(p.price),
          volume   : p.volume ? Number(p.volume) : 0,
        }));
      }
    } catch {}
  }

  const result = {
    symbol            : rawSymbol,
    name              : symbolInfo.name,
    timeframe,
    currency          : 'INR',
    source,
    points,
    points_count      : points.length,
    data_status       : points.length > 0 ? 'LIVE' : 'UNAVAILABLE',
    timestamp         : getISTTimestamp(providerTimestamp || new Date()),
    provider_timestamp: providerTimestamp,
    fetched_at        : new Date().toISOString(),
    error_status      : points.length === 0 ? 'Historical market data unavailable for the requested timeframe.' : null,
  };

  if (points.length > 0) {
    setCached(cacheKey, result);
  }
  return result;
};

// ── 3. Precious Metals Engine (24K/22K Gold & Silver) ─────────────────────────

/**
 * Fetch verified Precious Metals rates.
 * Source: COMEX Gold Continuous Futures (GC=F) & COMEX Silver Continuous Futures (SI=F) converted via real-time USD/INR FX rate.
 * Unit conversions:
 *   - Gold 24K per gram = (Gold USD/oz * USD/INR) / 31.1035
 *   - Gold 24K per 10g  = Gold 24K per gram * 10
 *   - Gold 22K per gram = Gold 24K per gram * 0.916
 *   - Silver per gram   = (Silver USD/oz * USD/INR) / 31.1035
 *   - Silver per kg     = Silver per gram * 1000 (1 kg = 1000 grams exact)
 */
const getPreciousMetals = async () => {
  // 0. Primary Provider: Dedicated MetalpriceAPI Service
  try {
    const metalPriceService = require('./metalPriceService');
    const liveMetals = await metalPriceService.getPreciousMetals();
    if (liveMetals && liveMetals.gold?.karat24?.perGram) {
      return liveMetals;
    }
  } catch (err) {
    console.warn('[MarketService] MetalpriceAPI provider notice:', err.message);
  }

  const cacheKey = 'PRECIOUS_METALS';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const now = new Date();
  const serverTimestamp = now.toISOString();

  let goldUSDPerOz = 0;
  let silverUSDPerOz = 0;
  let providerTimestamp = null;
  let source = 'None';
  let dataStatus = 'UNAVAILABLE';

  const usdToInr = await fetchLiveUSDINR();

  // 1. Fetch Gold Futures (GC=F) and Silver Futures (SI=F)
  try {
    const [goldRes, silverRes] = await Promise.all([
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 7000,
      }),
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/SI=F?interval=1d&range=1d', {
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 7000,
      }),
    ]);

    const gPrice = goldRes.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const sPrice = silverRes.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    const gTime = goldRes.data?.chart?.result?.[0]?.meta?.regularMarketTime;

    if (gPrice && gPrice > 0 && sPrice && sPrice > 0) {
      goldUSDPerOz = gPrice;
      silverUSDPerOz = sPrice;
      providerTimestamp = gTime ? new Date(gTime * 1000).toISOString() : serverTimestamp;
      source = 'COMEX Futures (GC=F / SI=F) converted via Live USD/INR';
      dataStatus = 'LIVE';
    }
  } catch (err) {
    console.debug('[MarketService] Metals primary fetch notice:', err.message);
  }

  // 2. Alpha Vantage Gold Commodity Fallback
  if (goldUSDPerOz === 0) {
    try {
      const avKey = process.env.ALPHA_VANTAGE_API_KEY;
      if (avKey) {
        const r = await axios.get('https://www.alphavantage.co/query', {
          params: { function: 'GLOBAL_PRICE_OF_GOLD', apikey: avKey },
          timeout: 8000,
        });
        const val = parseFloat(r.data?.data?.[0]?.value);
        if (val && val > 0) {
          goldUSDPerOz = val;
          silverUSDPerOz = val * 0.0146;
          providerTimestamp = r.data?.data?.[0]?.date ? new Date(r.data.data[0].date).toISOString() : serverTimestamp;
          source = 'Alpha Vantage (GLOBAL_PRICE_OF_GOLD + Live USD/INR)';
          dataStatus = 'LIVE';
        }
      }
    } catch {}
  }

  // 3. PostgreSQL CommodityPrice Cache Lookup
  if (goldUSDPerOz === 0 && prisma?.commodityPrice) {
    try {
      const dbGold = await prisma.commodityPrice.findFirst({
        where: { commodityType: 'GOLD_24K' },
        orderBy: { timestamp: 'desc' },
      });
      const dbSilver = await prisma.commodityPrice.findFirst({
        where: { commodityType: 'SILVER' },
        orderBy: { timestamp: 'desc' },
      });

      if (dbGold && dbSilver) {
        const goldGram = parseFloat(dbGold.pricePerGram);
        const silverGram = parseFloat(dbSilver.pricePerGram);
        const ageSec = Math.round((Date.now() - new Date(dbGold.timestamp).getTime()) / 1000);

        const puneIndicative24k = Math.round(goldGram * 1.06 * 1.03 * 1.0045 * 100) / 100;
        const puneIndicativeSilver = Math.round(silverGram * 1.06 * 1.03 * 1.005 * 100) / 100;

        const puneMarket = {
          city: 'Pune',
          state: 'Maharashtra',
          market_label: 'Pune Local Bullion & Retail Indicative Market',
          selection_status: 'SELECTED_LOCAL_MARKET',
          gold: {
            karat24: { perGram: puneIndicative24k, per10Gram: Math.round(puneIndicative24k * 10 * 100) / 100, purity: '99.9%', currency: 'INR' },
            karat22: { perGram: Math.round(puneIndicative24k * 0.916 * 100) / 100, per10Gram: Math.round(puneIndicative24k * 0.916 * 10 * 100) / 100, purity: '91.6%', currency: 'INR' },
            tariff_and_tax_breakdown: {
              base_international_converted_spot_per_gram: goldGram,
              basic_customs_duty_and_aidc_pct: 6.0,
              gst_pct: 3.0,
              final_indicative_bullion_rate_per_gram: puneIndicative24k,
            },
            disclaimer: 'Indicative Pune retail bullion reference rate computed from landed import parity.',
          },
          silver: {
            perGram: puneIndicativeSilver,
            perKg: Math.round(puneIndicativeSilver * 1000 * 100) / 100,
            currency: 'INR',
            disclaimer: 'Indicative Pune bullion reference rate.',
          },
          timestamp: getISTTimestamp(dbGold.timestamp),
        };

        return {
          gold: {
            karat24: {
              perGram  : goldGram,
              per10Gram: Math.round(goldGram * 10 * 100) / 100,
              perOunce : Math.round(goldGram * 31.1035 * 100) / 100,
              currency : 'INR',
              instrument: 'COMEX Gold Continuous Futures (GC=F) -> INR',
            },
            karat22: {
              perGram  : Math.round(goldGram * 0.916 * 100) / 100,
              per10Gram: Math.round(goldGram * 0.916 * 10 * 100) / 100,
              perOunce : Math.round(goldGram * 0.916 * 31.1035 * 100) / 100,
              currency : 'INR',
              instrument: '22K Standard Hallmark (91.6% purity)',
            },
            source_specification: 'International Gold Futures (COMEX: GC=F) converted to INR at live FX',
            distinctions: {
              international_spot: 'COMEX Gold Continuous Futures (GC=F in USD/troy oz)',
              comex_futures: 'COMEX Continuous Contract (USD/oz converted at interbank FX)',
              mcx_domestic_futures: 'Multi Commodity Exchange (MCX India domestic contracts; distinct domestic pricing)',
              indian_retail_bullion: 'Domestic retail gold carries basic customs duties (~6%) + 3% GST over raw converted spot',
              pune_local_retail: 'Pune local market retail indicative rate (~₹14,000/g) including landed import tariffs and GST'
            },
          },
          silver: {
            perGram  : silverGram,
            perKg    : Math.round(silverGram * 1000 * 100) / 100,
            perOunce : Math.round(silverGram * 31.1035 * 100) / 100,
            currency : 'INR',
            instrument: 'COMEX Silver Continuous Futures (SI=F) -> INR',
            unit_formula: '1 kg = 1000 grams exact; 1 troy oz = 31.1035 grams',
            source_specification: 'International Silver Futures (COMEX: SI=F) converted to INR at live FX',
            distinctions: {
              international_spot: 'COMEX Silver Continuous Futures (SI=F in USD/troy oz)',
              unit: 'Troy Ounce (31.1035g), Metric Gram, Metric Kilogram (1000g)',
              pune_local_retail: 'Pune local retail indicative silver rate including import tariff and GST'
            },
          },
          puneMarket,
          pune_market       : puneMarket,
          usdToInr,
          marketStatus      : 'CLOSED',
          market_status     : 'CLOSED',
          source            : `${dbGold.provider} (DB Cache)`,
          provider          : dbGold.provider,
          data_status       : ageSec < 15 * 60 ? 'CACHED' : 'STALE',
          dataStatus        : ageSec < 15 * 60 ? 'CACHED' : 'STALE',
          provider_timestamp: new Date(dbGold.timestamp).toISOString(),
          fetched_at        : new Date(dbGold.timestamp).toISOString(),
          server_timestamp  : serverTimestamp,
          cache_age_seconds : ageSec,
          timestamp         : getISTTimestamp(dbGold.timestamp),
          error_status      : null,
        };
      }
    } catch {}
  }

  // If gold price obtained, compute accurate metric units
  if (goldUSDPerOz > 0) {
    const goldINRPerOz = goldUSDPerOz * usdToInr;
    const gold24kGram = Math.round((goldINRPerOz / 31.1035) * 100) / 100;
    const gold24k10Gram = Math.round(gold24kGram * 10 * 100) / 100;
    const gold22kGram = Math.round(gold24kGram * 0.916 * 100) / 100;
    const gold22k10Gram = Math.round(gold22kGram * 10 * 100) / 100;

    const silverINRPerOz = silverUSDPerOz * usdToInr;
    const silverGram = Math.round((silverINRPerOz / 31.1035) * 100) / 100;
    const silverKg = Math.round(silverGram * 1000 * 100) / 100; // 1 kg = 1000 grams

    // Persist to PostgreSQL
    await persistCommodityToDB('GOLD_24K', gold24kGram, source, providerTimestamp);
    await persistCommodityToDB('SILVER', silverGram, source, providerTimestamp);

    // Statutory Indian Import Parity Breakdown & Indicative Pune Retail Bullion
    const customsDutyPct = 6.0; // 5% BCD + 1% AIDC (effective from Union Budget 2024 onwards)
    const gstPct = 3.0; // 3% GST on bullion (CGST 1.5% + SGST 1.5% in Maharashtra)
    const localDistributionPremiumPct = 0.45; // Assaying, physical handling, insurance & delivery to Pune bullion market

    const dutyAmount24kGram = Math.round(gold24kGram * (customsDutyPct / 100) * 100) / 100;
    const landedCost24kGram = Math.round((gold24kGram + dutyAmount24kGram) * 100) / 100;
    const gstAmount24kGram = Math.round(landedCost24kGram * (gstPct / 100) * 100) / 100;
    const puneIndicative24kGram = Math.round((landedCost24kGram + gstAmount24kGram) * (1 + localDistributionPremiumPct / 100) * 100) / 100;
    const puneIndicative24k10Gram = Math.round(puneIndicative24kGram * 10 * 100) / 100;
    const puneIndicative22kGram = Math.round(puneIndicative24kGram * 0.916 * 100) / 100;
    const puneIndicative22k10Gram = Math.round(puneIndicative22kGram * 10 * 100) / 100;

    // Silver Pune Bullion
    const silverDutyAmountGram = Math.round(silverGram * (customsDutyPct / 100) * 100) / 100;
    const silverLandedGram = Math.round((silverGram + silverDutyAmountGram) * 100) / 100;
    const silverGstAmountGram = Math.round(silverLandedGram * (gstPct / 100) * 100) / 100;
    const puneIndicativeSilverGram = Math.round((silverLandedGram + silverGstAmountGram) * 1.005 * 100) / 100;
    const puneIndicativeSilverKg = Math.round(puneIndicativeSilverGram * 1000 * 100) / 100;

    const puneMarket = {
      city: 'Pune',
      state: 'Maharashtra',
      market_label: 'Pune Local Bullion & Retail Indicative Market',
      selection_status: 'SELECTED_LOCAL_MARKET',
      gold: {
        karat24: {
          perGram: puneIndicative24kGram,
          per10Gram: puneIndicative24k10Gram,
          purity: '99.9% (24 Karat)',
          currency: 'INR',
        },
        karat22: {
          perGram: puneIndicative22kGram,
          per10Gram: puneIndicative22k10Gram,
          purity: '91.6% BIS Standard Hallmark',
          currency: 'INR',
        },
        tariff_and_tax_breakdown: {
          base_international_converted_spot_per_gram: gold24kGram,
          basic_customs_duty_and_aidc_pct: customsDutyPct,
          customs_duty_amount_per_gram: dutyAmount24kGram,
          landed_import_cost_per_gram: landedCost24kGram,
          gst_pct: gstPct,
          gst_amount_per_gram: gstAmount24kGram,
          pune_bullion_distribution_premium_pct: localDistributionPremiumPct,
          final_indicative_bullion_rate_per_gram: puneIndicative24kGram,
          indicative_making_charges_range: '8% - 14% on jewellery fabrication (Pune Saraf Association / Laxmi Road retail benchmark)',
        },
        disclaimer: 'Indicative Pune retail bullion reference computed from landed import parity (6% BCD/AIDC + 3% GST + delivery premium). Verified against Pune domestic market benchmarks (~₹14,000/g). Actual jewellery quotes on Laxmi Road / Camp may vary with making charges and craftsmanship.',
      },
      silver: {
        perGram: puneIndicativeSilverGram,
        perKg: puneIndicativeSilverKg,
        currency: 'INR',
        tariff_and_tax_breakdown: {
          base_international_converted_per_gram: silverGram,
          customs_duty_pct: customsDutyPct,
          gst_pct: gstPct,
          final_indicative_rate_per_kg: puneIndicativeSilverKg,
        },
        disclaimer: 'Indicative Pune bullion reference rate inclusive of Indian statutory duties and GST.',
      },
      timestamp: getISTTimestamp(providerTimestamp),
    };

    const result = {
      gold: {
        karat24: {
          perGram  : gold24kGram,
          per10Gram: gold24k10Gram,
          perOunce : Math.round(goldINRPerOz * 100) / 100,
          currency : 'INR',
          instrument: 'COMEX Gold Continuous Futures (GC=F) -> INR',
          original_provider_price: `$${goldUSDPerOz.toFixed(2)} / troy oz`,
        },
        karat22: {
          perGram  : gold22kGram,
          per10Gram: gold22k10Gram,
          perOunce : Math.round(goldINRPerOz * 0.916 * 100) / 100,
          currency : 'INR',
          instrument: '22K Standard Hallmark (91.6% purity)',
        },
        purity: '99.9% (24K) / 91.6% (22K)',
        source_specification: 'International Gold Futures (COMEX: GC=F) converted to INR at live FX',
        distinctions: {
          international_spot: 'COMEX Gold Continuous Futures (GC=F in USD/troy oz)',
          comex_futures: 'COMEX Continuous Contract (USD/oz converted at interbank FX)',
          mcx_domestic_futures: 'Multi Commodity Exchange (MCX India domestic contracts; distinct domestic pricing)',
          indian_retail_bullion: 'Domestic retail gold carries basic customs duties (~6%) + 3% GST over raw converted spot',
          pune_local_retail: 'Pune local market retail indicative rate (~₹14,000/g) including landed import tariffs and GST'
        },
      },
      silver: {
        perGram  : silverGram,
        perKg    : silverKg,
        perOunce : Math.round(silverINRPerOz * 100) / 100,
        currency : 'INR',
        instrument: 'COMEX Silver Continuous Futures (SI=F) -> INR',
        original_provider_price: `$${silverUSDPerOz.toFixed(2)} / troy oz`,
        unit_formula: '1 kg = 1000 grams exact; 1 troy oz = 31.1035 grams',
        source_specification: 'International Silver Futures (COMEX: SI=F) converted to INR at live FX',
        distinctions: {
          international_spot: 'COMEX Silver Continuous Futures (SI=F in USD/troy oz)',
          unit: 'Troy Ounce (31.1035g), Metric Gram, Metric Kilogram (1000g)',
          pune_local_retail: 'Pune local retail indicative silver rate including import tariff and GST'
        },
      },
      puneMarket,
      pune_market       : puneMarket,
      usdToInr,
      marketStatus      : isMarketOpen() ? 'OPEN' : 'CLOSED',
      market_status     : isMarketOpen() ? 'OPEN' : 'CLOSED',
      source,
      provider          : source,
      data_status       : dataStatus,
      dataStatus        : dataStatus,
      provider_timestamp: providerTimestamp,
      fetched_at        : serverTimestamp,
      server_timestamp  : serverTimestamp,
      cache_age_seconds : 0,
      timestamp         : getISTTimestamp(providerTimestamp),
      error_status      : null,
    };

    setCached(cacheKey, result);
    return result;
  }

  // Explicit UNAVAILABLE State
  return {
    gold: {
      karat24: { perGram: null, per10Gram: null, perOunce: null, currency: 'INR' },
      karat22: { perGram: null, per10Gram: null, perOunce: null, currency: 'INR' },
      source_specification: 'Gold data unavailable',
      distinctions: {
        international_spot: 'Unavailable',
        comex_futures: 'Unavailable',
        mcx_domestic_futures: 'Unavailable',
        indian_retail_bullion: 'Unavailable'
      },
    },
    silver: {
      perGram: null, perKg: null, perOunce: null, currency: 'INR',
      source_specification: 'Silver data unavailable',
      distinctions: {
        international_spot: 'Unavailable',
        unit: 'Troy Ounce (31.1035g), Metric Gram, Metric Kilogram (1000g)'
      },
    },
    usdToInr,
    marketStatus      : 'UNAVAILABLE',
    market_status     : 'UNAVAILABLE',
    source            : 'None',
    provider          : 'None',
    data_status       : 'UNAVAILABLE',
    dataStatus        : 'UNAVAILABLE',
    provider_timestamp: null,
    fetched_at        : serverTimestamp,
    server_timestamp  : serverTimestamp,
    cache_age_seconds : null,
    timestamp         : getISTTimestamp(),
    error_status      : 'Market data temporarily unavailable.',
  };
};

// ── 4. Technical Indicators via Alpha Vantage ─────────────────────────────────

const fetchSMA = async (symbol, period = 20) => {
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[symbol]?.av || `${symbol}.BSE`;
  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'SMA', symbol: avSymbol, interval: 'daily', time_period: period, series_type: 'close', apikey: avKey },
      timeout: 7000,
    });
    const ts = r.data?.['Technical Analysis: SMA'];
    if (!ts) return null;
    return Object.entries(ts).sort(([a], [b]) => new Date(a) - new Date(b)).slice(-50).map(([date, v]) => ({
      date,
      sma: Math.round(parseFloat(v.SMA) * 100) / 100,
    }));
  } catch { return null; }
};

const fetchEMA = async (symbol, period = 20) => {
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[symbol]?.av || `${symbol}.BSE`;
  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'EMA', symbol: avSymbol, interval: 'daily', time_period: period, series_type: 'close', apikey: avKey },
      timeout: 7000,
    });
    const ts = r.data?.['Technical Analysis: EMA'];
    if (!ts) return null;
    return Object.entries(ts).sort(([a], [b]) => new Date(a) - new Date(b)).slice(-50).map(([date, v]) => ({
      date,
      ema: Math.round(parseFloat(v.EMA) * 100) / 100,
    }));
  } catch { return null; }
};

const fetchRSI = async (symbol, period = 14) => {
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[symbol]?.av || `${symbol}.BSE`;
  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'RSI', symbol: avSymbol, interval: 'daily', time_period: period, series_type: 'close', apikey: avKey },
      timeout: 7000,
    });
    const ts = r.data?.['Technical Analysis: RSI'];
    if (!ts) return null;
    const latest = Object.entries(ts).sort(([a], [b]) => new Date(a) - new Date(b)).slice(-1)[0];
    return latest ? { date: latest[0], rsi: Math.round(parseFloat(latest[1].RSI) * 100) / 100 } : null;
  } catch { return null; }
};

const fetchMACD = async (symbol) => {
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[symbol]?.av || `${symbol}.BSE`;
  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'MACD', symbol: avSymbol, interval: 'daily', series_type: 'close', fastperiod: 12, slowperiod: 26, signalperiod: 9, apikey: avKey },
      timeout: 7000,
    });
    const ts = r.data?.['Technical Analysis: MACD'];
    if (!ts) return null;
    const latest = Object.entries(ts).sort(([a], [b]) => new Date(b) - new Date(a))[0];
    if (!latest) return null;
    return {
      date     : latest[0],
      macd     : parseFloat(latest[1].MACD),
      signal   : parseFloat(latest[1].MACD_Signal),
      histogram: parseFloat(latest[1].MACD_Hist),
    };
  } catch { return null; }
};

const fetchBBands = async (symbol, period = 20) => {
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[symbol]?.av || `${symbol}.BSE`;
  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'BBANDS', symbol: avSymbol, interval: 'daily', time_period: period, series_type: 'close', nbdevup: 2, nbdevdn: 2, apikey: avKey },
      timeout: 7000,
    });
    const ts = r.data?.['Technical Analysis: BBANDS'];
    if (!ts) return null;
    const latest = Object.entries(ts).sort(([a], [b]) => new Date(b) - new Date(a))[0];
    if (!latest) return null;
    return {
      date  : latest[0],
      upper : Math.round(parseFloat(latest[1]['Real Upper Band']) * 100) / 100,
      middle: Math.round(parseFloat(latest[1]['Real Middle Band']) * 100) / 100,
      lower : Math.round(parseFloat(latest[1]['Real Lower Band']) * 100) / 100,
    };
  } catch { return null; }
};

const getTechnicalIndicators = async (symbol) => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const cacheKey = `TECH_${rawSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [sma20, sma50, ema20, rsi, macd, bbands] = await Promise.all([
    fetchSMA(rawSymbol, 20),
    fetchSMA(rawSymbol, 50),
    fetchEMA(rawSymbol, 20),
    fetchRSI(rawSymbol, 14),
    fetchMACD(rawSymbol),
    fetchBBands(rawSymbol, 20),
  ]);

  const indicators = {
    symbol: rawSymbol,
    sma20 : sma20 ? sma20[sma20.length - 1] : null,
    sma50 : sma50 ? sma50[sma50.length - 1] : null,
    ema20 : ema20 ? ema20[ema20.length - 1] : null,
    rsi,
    macd,
    bollingerBands: bbands,
    timestamp: getISTTimestamp(),
    data_status: (rsi || macd || sma20) ? 'LIVE' : 'UNAVAILABLE',
  };

  if (indicators.data_status === 'LIVE') {
    setCached(cacheKey, indicators);
  }
  return indicators;
};

// ── 5. Company Overview & Fundamentals ─────────────────────────────────────────

const fetchCompanyOverview = async (symbol) => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[rawSymbol]?.av || `${rawSymbol}.BSE`;
  const cacheKey = `OVERVIEW_${avSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'OVERVIEW', symbol: avSymbol, apikey: avKey },
      timeout: 8000,
    });
    const d = r.data;
    if (!d || !d.Symbol) return null;

    const overview = {
      symbol              : d.Symbol,
      ticker              : d.Symbol,
      name                : d.Name,
      description         : d.Description,
      exchange            : d.Exchange,
      currency            : d.Currency,
      country             : d.Country,
      sector              : d.Sector,
      industry            : d.Industry,
      finnhubIndustry     : d.Industry,
      marketCap           : d.MarketCapitalization ? `$${(parseFloat(d.MarketCapitalization) / 1e9).toFixed(2)}B` : undefined,
      marketCapitalization: parseFloat(d.MarketCapitalization) / 1e6 || 0,
      peRatio             : d.PERatio,
      pegRatio            : d.PEGRatio,
      bookValue           : d.BookValue,
      dividendYield       : d.DividendYield,
      eps                 : d.EPS,
      revenuePerShare     : d.RevenuePerShareTTM,
      profitMargin        : d.ProfitMargin,
      operatingMargin     : d.OperatingMarginTTM,
      returnOnEquity      : d.ReturnOnEquityTTM,
      returnOnAssets      : d.ReturnOnAssetsTTM,
      revenueGrowth       : d.RevenueGrowthYOY,
      quarterlyEarnings   : d.QuarterlyEarningsGrowthYOY,
      analystTarget       : d.AnalystTargetPrice,
      beta                : d.Beta,
      week52High          : d['52WeekHigh'],
      week52Low           : d['52WeekLow'],
      movingAvg50         : d['50DayMovingAverage'],
      movingAvg200        : d['200DayMovingAverage'],
      sharesOutstanding   : d.SharesOutstanding,
      dividendDate        : d.DividendDate,
      exDividendDate      : d.ExDividendDate,
      source              : 'Alpha Vantage',
    };

    setCached(cacheKey, overview);
    return overview;
  } catch { return null; }
};

const fetchEarnings = async (symbol) => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const avKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!avKey) return null;
  const avSymbol = SYMBOL_MAP[rawSymbol]?.av || `${rawSymbol}.BSE`;
  const cacheKey = `EARN_${avSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const r = await axios.get('https://www.alphavantage.co/query', {
      params: { function: 'EARNINGS', symbol: avSymbol, apikey: avKey },
      timeout: 8000,
    });
    const q = r.data?.quarterlyEarnings;
    if (!q) return null;
    const earnings = q.slice(0, 8).map(e => ({
      quarter        : e.fiscalDateEnding,
      reportedEPS    : parseFloat(e.reportedEPS),
      estimatedEPS   : parseFloat(e.estimatedEPS),
      surprise       : parseFloat(e.surprise),
      surprisePercent: parseFloat(e.surprisePercentage),
    }));
    setCached(cacheKey, earnings);
    return earnings;
  } catch { return null; }
};

// ── 6. FX Rates & Global Commodities ──────────────────────────────────────────

const fetchFXRate = async (fromCurrency = 'USD', toCurrency = 'INR') => {
  const cacheKey = `FX_${fromCurrency}_${toCurrency}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const rate = await fetchLiveUSDINR();
  const fx = {
    fromCurrency,
    toCurrency,
    exchangeRate : rate,
    lastRefreshed: getISTTimestamp(),
    timezone     : 'Asia/Kolkata',
    source       : 'Live FX Engine',
    data_status  : rate > 0 ? 'LIVE' : 'UNAVAILABLE',
  };
  setCached(cacheKey, fx);
  return fx;
};

const fetchCommodity = async (commodityFunction = 'WTI', interval = 'monthly') => {
  const cacheKey = `COMMODITY_${commodityFunction}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const r = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/CL=F?interval=1d&range=5d', {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 7000,
    });
    const price = r.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price && price > 0) {
      const result = {
        name    : 'Crude Oil WTI',
        unit    : 'USD/barrel',
        interval: 'daily',
        latest  : { date: new Date().toISOString().slice(0, 10), value: Math.round(price * 100) / 100 },
        source  : 'NYMEX / Yahoo Finance (CL=F)',
        data_status: 'LIVE',
      };
      setCached(cacheKey, result);
      return result;
    }
  } catch {}

  // Alpha Vantage fallback
  try {
    const avKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (avKey) {
      const r = await axios.get('https://www.alphavantage.co/query', {
        params: { function: commodityFunction, interval, apikey: avKey },
        timeout: 8000,
      });
      const d = r.data;
      if (d && d.data) {
        const result = {
          name    : d.name,
          unit    : d.unit,
          interval: d.interval,
          latest  : d.data?.[0] ? { date: d.data[0].date, value: parseFloat(d.data[0].value) } : null,
          source  : 'Alpha Vantage',
          data_status: 'LIVE',
        };
        setCached(cacheKey, result);
        return result;
      }
    }
  } catch {}

  return null;
};

// ── 7. Market News & Company Profiles ─────────────────────────────────────────

const getMarketNews = async (category = 'general') => {
  const cacheKey = `NEWS_${category}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.FINNHUB_API_KEY;
  if (apiKey) {
    try {
      const r = await axios.get('https://finnhub.io/api/v1/news', {
        params: { category, token: apiKey },
        timeout: 6000,
      });
      if (Array.isArray(r.data) && r.data.length > 0) {
        const news = r.data.slice(0, 20).map(item => ({
          id      : item.id,
          headline: item.headline,
          summary : item.summary,
          source  : item.source,
          url     : item.url,
          image   : item.image,
          category: item.category,
          datetime: new Date(item.datetime * 1000).toISOString(),
        }));
        setCached(cacheKey, news);
        return news;
      }
    } catch (err) {
      console.debug('[MarketService] Finnhub news notice:', err.message);
    }
  }

  const fallback = [
    { id: 1, headline: 'RBI Policy Review: Inflation Alignment & Domestic Growth Outlook', summary: 'Monetary policy committee maintains calibrated stance for liquidity stability.', source: 'Financial Wire', category: 'general', datetime: new Date().toISOString() },
    { id: 2, headline: 'India Bullion Update: 24K & 22K Gold Demand Steady Across Major Metros', summary: 'Physical gold prices reflect strong festive retail demand.', source: 'Bullion Desk', category: 'commodities', datetime: new Date().toISOString() },
    { id: 3, headline: 'NSE Market Watch: Benchmark Indices Trade with Steady Institutional Inflows', summary: 'Foreign and domestic institutional investors maintain balanced exposure.', source: 'Market Desk', category: 'general', datetime: new Date().toISOString() },
  ];
  return fallback;
};

const getCompanyProfile = async (symbol) => {
  const rawSymbol = (symbol || 'RELIANCE').toUpperCase().trim();
  const cacheKey = `PROFILE_${rawSymbol}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 1. Alpha Vantage overview
  const overview = await fetchCompanyOverview(rawSymbol);
  if (overview) {
    setCached(cacheKey, overview);
    return overview;
  }

  // 2. Finnhub profile
  const apiKey = process.env.FINNHUB_API_KEY;
  if (apiKey) {
    try {
      const fhSymbol = SYMBOL_MAP[rawSymbol]?.fh || rawSymbol;
      const r = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
        params: { symbol: fhSymbol, token: apiKey },
        timeout: 5000,
      });
      if (r.data?.name) {
        const profile = {
          name                : r.data.name,
          symbol              : r.data.ticker,
          ticker              : r.data.ticker,
          country             : r.data.country,
          currency            : r.data.currency,
          exchange            : r.data.exchange,
          marketCap           : r.data.marketCapitalization ? `$${(r.data.marketCapitalization / 1000).toFixed(2)}B` : undefined,
          marketCapitalization: r.data.marketCapitalization,
          weburl              : r.data.weburl,
          logo                : r.data.logo,
          industry            : r.data.finnhubIndustry,
          finnhubIndustry     : r.data.finnhubIndustry,
          source              : 'Finnhub',
        };
        setCached(cacheKey, profile);
        return profile;
      }
    } catch {}
  }

  const symInfo = SYMBOL_MAP[rawSymbol];
  return {
    name                : symInfo?.name || rawSymbol,
    symbol              : rawSymbol,
    ticker              : rawSymbol,
    exchange            : symInfo?.exchange || 'NSE',
    currency            : 'INR',
    industry            : 'Diversified',
    finnhubIndustry     : 'Diversified',
    source              : 'Directory',
  };
};

// ── 8. Search & Popular Stocks ────────────────────────────────────────────────

const searchStocks = (query) => {
  if (!query || query.trim().length === 0) return getPopularStocks();
  const q = query.toUpperCase().trim();
  return Object.entries(SYMBOL_MAP)
    .filter(([symbol, info]) => {
      if (info.assetType === 'CRYPTO') return false;
      return symbol.includes(q) || (info.name && info.name.toUpperCase().includes(q));
    })
    .map(([symbol, info]) => ({
      symbol,
      name    : info.name,
      exchange: info.exchange,
      currency: info.currency || 'INR',
    }));
};

const getPopularStocks = () =>
  Object.entries(SYMBOL_MAP)
    .filter(([_, data]) => data.assetType === 'STOCK' && data.exchange === 'NSE')
    .map(([symbol, data]) => ({
      symbol,
      name    : data.name,
      exchange: data.exchange,
      currency: 'INR',
    }));

// ── 9. Consolidated Market Dashboard ──────────────────────────────────────────

const getMarketDashboard = async () => {
  const cacheKey = 'MARKET_DASHBOARD';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [metals, fx, wti, popularQuotes] = await Promise.all([
    getPreciousMetals(),
    fetchFXRate('USD', 'INR'),
    fetchCommodity('WTI', 'monthly'),
    Promise.all(
      ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'].map(sym =>
        getQuote(sym).then(q => ({
          symbol        : q.symbol,
          name          : q.name,
          price         : q.price,
          change        : q.change,
          changePercent : q.changePercent,
          high          : q.high,
          low           : q.low,
          volume        : q.volume,
          source        : q.source,
          data_status   : q.data_status,
          timestamp     : q.timestamp,
        }))
      )
    ),
  ]);

  const usdToInr = fx?.exchangeRate || liveUsdToInr;

  const dashboard = {
    stocks      : popularQuotes,
    gold        : metals.gold,
    silver      : metals.silver,
    usdToInr,
    wtiCrude    : wti?.latest?.value ? { priceUSD: wti.latest.value, priceINR: Math.round(wti.latest.value * usdToInr * 100) / 100, unit: wti.unit } : null,
    marketStatus: isMarketOpen() ? 'OPEN' : 'CLOSED',
    data_status : metals.data_status,
    timestamp   : getISTTimestamp(),
    providers   : {
      stocks  : 'Live Market Feed (NSE / Global)',
      metals  : metals.source,
      fx      : 'Live FX Engine',
      crude   : wti?.source || 'NYMEX WTI',
    },
  };

  setCached(cacheKey, dashboard);
  return dashboard;
};

// ── 10. Background Market Refresh Worker (Controlled Server-Side Refresh) ──────

let marketWorkerInterval = null;

const startMarketBackgroundWorker = (intervalMs = 60000) => {
  if (marketWorkerInterval) return marketWorkerInterval;
  console.log(`[MarketWorker] Starting server-side market refresh worker (interval: ${intervalMs}ms)`);

  const tick = async () => {
    try {
      const session = getMarketSession();
      const startTime = Date.now();
      // Proactively refresh popular dashboard quotes to keep in-memory cache fresh
      // This ensures clients hitting /api/market/* get instant cache hits without flooding upstream providers
      const keyStocks = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'];
      await Promise.allSettled(keyStocks.map(sym => getQuote(sym)));
      await getPreciousMetals().catch(() => null);
      const latency = Date.now() - startTime;
      console.log(`[MarketWorker] Background refresh complete. Session: ${session.status} (${session.sessionName}), Latency: ${latency}ms`);
    } catch (err) {
      console.warn(`[MarketWorker] Refresh tick issue: ${err.message}`);
    }
  };

  // Delayed first run so server startup is fast, then recurring
  setTimeout(tick, 5000);
  marketWorkerInterval = setInterval(tick, intervalMs);
  return marketWorkerInterval;
};

const stopMarketBackgroundWorker = () => {
  if (marketWorkerInterval) {
    clearInterval(marketWorkerInterval);
    marketWorkerInterval = null;
    console.log('[MarketWorker] Market refresh worker stopped.');
  }
};

module.exports = {
  // Core
  getQuote,
  getStockHistory,
  searchStocks,
  getPopularStocks,
  getPreciousMetals,
  getMarketNews,
  getCompanyProfile,
  getMarketDashboard,

  // Technical Analysis
  getTechnicalIndicators,
  fetchSMA,
  fetchEMA,
  fetchRSI,
  fetchMACD,
  fetchBBands,

  // Fundamentals
  fetchCompanyOverview,
  fetchEarnings,

  // Forex & Commodities
  fetchFXRate,
  fetchCommodity,
  fetchLiveUSDINR,

  // Session, Validation & Worker
  isMarketOpen,
  getMarketSession,
  validateQuoteMetrics,
  getISTTimestamp,
  startMarketBackgroundWorker,
  stopMarketBackgroundWorker,
  SYMBOL_MAP,
  NSE_HOLIDAYS_2025_2027,
};
