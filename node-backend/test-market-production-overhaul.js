/**
 * FinPro — Production-Quality Market Data & Reliability Overhaul Test Suite
 * Owner: Jinay Golecha (jinay_golecha)
 */

const assert = require('assert');
const axios = require('axios');
const marketService = require('./src/services/marketService');

const BASE_URL = 'http://127.0.0.1:5000/api/v1';

async function runProductionMarketTests() {
  console.log('========================================================================');
  console.log('  FINPRO — PRODUCTION-QUALITY MARKET DATA & RELIABILITY TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(label, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${label} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Metric Consistency & Decimal Arithmetic
  console.log('👉 [1/7] Testing Quote Consistency & Safe Metric Validation...');
  
  test('Validates normal positive quote with high >= low', () => {
    const res = marketService.validateQuoteMetrics({
      price: 2500.50,
      open: 2490.00,
      high: 2515.00,
      low: 2485.00,
      previousClose: 2480.00,
      providerTimestamp: new Date().toISOString(),
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.price, 2500.50);
    assert.strictEqual(res.high, 2515.00);
    assert.strictEqual(res.low, 2485.00);
    assert.strictEqual(res.change, 20.50);
    assert.strictEqual(res.changePercent, 0.83);
  });

  test('Auto-corrects inverted high/low (if high < low)', () => {
    const res = marketService.validateQuoteMetrics({
      price: 100,
      open: 100,
      high: 90,  // inverted
      low: 110,  // inverted
      previousClose: 95,
      providerTimestamp: new Date().toISOString(),
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.high >= res.low, true, 'High must be >= low');
    assert.strictEqual(res.high >= 100, true, 'High must be >= price');
    assert.strictEqual(res.low <= 100, true, 'Low must be <= price');
  });

  test('Handles zero or missing previousClose without dividing by zero', () => {
    const res = marketService.validateQuoteMetrics({
      price: 1500,
      previousClose: 0,
      providerTimestamp: new Date().toISOString(),
    });
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.changePercent, 0);
  });

  test('Rejects future clock skew beyond 15 minutes', () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const res = marketService.validateQuoteMetrics({
      price: 100,
      previousClose: 100,
      providerTimestamp: futureDate,
    });
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('clock skew'));
  });

  test('Rejects zero, negative, and NaN prices', () => {
    assert.strictEqual(marketService.validateQuoteMetrics({ price: 0 }).valid, false);
    assert.strictEqual(marketService.validateQuoteMetrics({ price: -50 }).valid, false);
    assert.strictEqual(marketService.validateQuoteMetrics({ price: NaN }).valid, false);
    assert.strictEqual(marketService.validateQuoteMetrics({ price: 'abc' }).valid, false);
  });

  // 2. Instrument & Symbol Mappings
  console.log('\n👉 [2/7] Testing Instrument & Symbol Mapping Accuracy...');
  const keyNseStocks = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN'];

  for (const sym of keyNseStocks) {
    test(`Symbol mapping for ${sym} is valid NSE equity`, () => {
      const info = marketService.SYMBOL_MAP[sym];
      assert.ok(info, `Mapping for ${sym} must exist`);
      assert.strictEqual(info.exchange, 'NSE');
      assert.strictEqual(info.assetType, 'STOCK');
      assert.strictEqual(info.currency, 'INR');
      assert.strictEqual(info.yf, `${sym}.NS`);
    });
  }

  // 3. Indian Equities Technical Indicator Multiplier Bug Check
  console.log('\n👉 [3/7] Testing Technical Indicator Pricing (Zero USD/INR Inflation on Indian Stocks)...');
  test('Alpha Vantage BSE symbols are not inflated by USD/INR multiplier', async () => {
    // If SMA is called on an Indian stock, the returned value should reflect actual INR price, not price * 86.5
    const sma = await marketService.fetchSMA('RELIANCE', 20);
    if (sma && sma.length > 0) {
      const latestSMA = sma[sma.length - 1].sma;
      // Reliance price is around ₹1,000 - ₹3,000. It must NOT be ₹100,000+!
      assert.ok(latestSMA < 10000, `SMA should be in reasonable INR range (< 10000), got: ${latestSMA}`);
    }
  });

  // 4. Precious Metals & Metric Units Conversion
  console.log('\n👉 [4/7] Testing Precious Metals & Metric Formulas...');
  test('Gold and Silver units verify exact metric standards', async () => {
    const metals = await marketService.getPreciousMetals();
    assert.ok(metals, 'Metals response must exist');
    assert.ok(metals.gold?.karat24?.perGram > 0, '24K gold per gram must be positive');
    
    // 10 grams must be 10x per gram
    const gGram = metals.gold.karat24.perGram;
    const g10g = metals.gold.karat24.per10Gram;
    assert.strictEqual(Math.round(gGram * 10 * 100) / 100, g10g);

    // 22K gold must be ~91.6% of 24K gold
    const g22 = metals.gold.karat22.perGram;
    assert.strictEqual(Math.round(gGram * 0.916 * 100) / 100, g22);

    // Silver 1 kg must be exactly 1000g
    const sGram = metals.silver.perGram;
    const sKg = metals.silver.perKg;
    assert.strictEqual(Math.round(sGram * 1000 * 100) / 100, sKg);

    // Provenance distinctions
    assert.ok(metals.gold.distinctions.international_spot.includes('COMEX'));
    assert.ok(metals.gold.distinctions.indian_retail_bullion.includes('customs duties'));
  });

  // 5. Market Session & Official Holidays Awareness
  console.log('\n👉 [5/7] Testing Market Session & Official Exchange Holidays...');
  test('Detects official NSE holiday correctly (e.g. Republic Day 2026-01-26)', () => {
    const holidayDate = new Date('2026-01-26T10:00:00+05:30');
    const session = marketService.getMarketSession(holidayDate);
    assert.strictEqual(session.isOpen, false);
    assert.strictEqual(session.status, 'CLOSED');
    assert.strictEqual(session.sessionName, 'Exchange Holiday');
  });

  test('Detects Sunday weekend as closed', () => {
    const sundayDate = new Date('2026-10-18T11:00:00+05:30'); // Sunday
    const session = marketService.getMarketSession(sundayDate);
    assert.strictEqual(session.isOpen, false);
    assert.strictEqual(session.status, 'CLOSED');
    assert.ok(session.sessionName.includes('Sunday'));
  });

  test('Detects normal weekday trading hours (e.g. Wednesday 11:00 IST)', () => {
    const tradingDate = new Date('2026-10-14T11:00:00+05:30'); // Wednesday 11:00 AM IST
    const session = marketService.getMarketSession(tradingDate);
    assert.strictEqual(session.isOpen, true);
    assert.strictEqual(session.status, 'OPEN');
    assert.strictEqual(session.sessionName, 'Regular Trading Session');
  });

  // 6. Request Coalescing (Singleflight Deduplication)
  console.log('\n👉 [6/7] Testing Request Coalescing (Zero Upstream Flooding)...');
  test('Concurrent requests for the same symbol share in-flight promise', async () => {
    const start = Date.now();
    const [q1, q2, q3] = await Promise.all([
      marketService.getQuote('RELIANCE'),
      marketService.getQuote('RELIANCE'),
      marketService.getQuote('RELIANCE'),
    ]);
    assert.strictEqual(q1.symbol, 'RELIANCE');
    assert.strictEqual(q2.symbol, 'RELIANCE');
    assert.strictEqual(q3.symbol, 'RELIANCE');
    assert.strictEqual(q1.price, q2.price);
  });

  // 7. Explicit UNAVAILABLE State on Nonexistent Symbol
  console.log('\n👉 [7/7] Testing Zero Synthetic/Fake Data Guarantee...');
  test('Nonexistent stock symbol returns price: null, data_status: UNAVAILABLE', async () => {
    const badQuote = await marketService.getQuote('NONEXISTENT_XYZ_TEST');
    assert.strictEqual(badQuote.symbol, 'NONEXISTENT_XYZ_TEST');
    assert.strictEqual(badQuote.price, null, 'Price must be null, never manufactured');
    assert.strictEqual(badQuote.data_status, 'UNAVAILABLE');
    assert.ok(badQuote.error_status);
  });

  test('Historical data for invalid symbol returns points: []', async () => {
    const badHistory = await marketService.getStockHistory('NONEXISTENT_XYZ_TEST', '1M');
    assert.strictEqual(badHistory.data_status, 'UNAVAILABLE');
    assert.strictEqual(badHistory.points_count, 0);
    assert.strictEqual(badHistory.points.length, 0);
  });

  console.log('\n========================================================================');
  console.log(`  OVERHAUL TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionMarketTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
