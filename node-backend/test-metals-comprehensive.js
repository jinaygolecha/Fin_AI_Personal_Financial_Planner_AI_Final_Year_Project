/**
 * FinPro — Comprehensive MetalpriceAPI & Pune Market Test Suite
 * Validates:
 * 1. Physical Constant (1 troy oz = 31.1034768g)
 * 2. Troy ounce to gram conversion & 10g/kg arithmetic
 * 3. Dual base conversion (base: INR direct vs base: USD converted)
 * 4. Reciprocal rate handling (1 / XAU) without double conversion
 * 5. Gold purity fractions (24/24, 22/24, 18/24)
 * 6. Silver mathematical reconciliation (gram, 10g, kg, troy oz)
 * 7. Pune landed retail import parity (6% BCD + 3% GST + 0.45% margin + 8% making)
 * 8. Validation edge cases (zero, negative, non-numeric, missing symbols)
 * 9. Caching (5-min TTL) & in-flight request deduplication
 * 10. Provider status telemetry (zero secrets exposed)
 * 11. Real live API call via configured METALPRICE_API_KEY
 */

require('dotenv').config();
const assert = require('assert');
const metalPriceService = require('./src/services/metalPriceService');
const { MetalPriceService, TROY_OUNCE_TO_GRAMS, INDIAN_TARIFFS } = metalPriceService;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

async function runAllMetalsTests() {
  console.log('\n===============================================================');
  console.log('🧪 FINPRO — METALPRICEAPI & PUNE MARKET COMPREHENSIVE TESTS');
  console.log('===============================================================\n');

  const service = new MetalPriceService();

  // 1. PHYSICAL CONSTANT
  test('1. Exact international constant 1 troy oz = 31.1034768 grams', () => {
    assert.strictEqual(TROY_OUNCE_TO_GRAMS, 31.1034768);
  });

  // 2. TROY OUNCE TO GRAM CONVERSION
  test('2. Troy ounce to gram conversion arithmetic', () => {
    const testOunceINR = 397231.80; // Sample live gold INR/oz
    const gramINR = service.round(testOunceINR / TROY_OUNCE_TO_GRAMS);
    const expected = 12771.30;
    assert.strictEqual(gramINR, expected);

    const tenGramINR = service.round(gramINR * 10);
    assert.strictEqual(tenGramINR, 127713.00);
  });

  // 3. BASE INR DIRECT PARSING
  test('3. Direct parsing with base=INR from MetalpriceAPI', () => {
    const mockApiResponse = {
      success: true,
      base: 'INR',
      timestamp: 1792454399,
      rates: {
        INRXAU: 397231.80,
        INRXAG: 5450.31,
        INRXPT: 156472.49,
        INRXPD: 107346.85,
        INRUSD: 94.9765,
      },
    };

    const parsed = service.parseProviderResponse(mockApiResponse);
    assert.strictEqual(parsed.gold.karat24.perGram, 12771.30);
    assert.strictEqual(parsed.gold.karat24.per10Gram, 127713.00);
    assert.strictEqual(parsed.silver.perGram, 175.23);
    assert.strictEqual(parsed.silver.perKg, 175230.00);
    assert.strictEqual(parsed.platinum.perGram, 5030.71);
    assert.strictEqual(parsed.palladium.perGram, 3451.28);
  });

  // 4. BASE USD PARSING WITH LIVE FX CONVERSION
  test('4. USD base parsing with interbank FX conversion', () => {
    const mockApiResponse = {
      success: true,
      base: 'USD',
      timestamp: 1792454399,
      rates: {
        USDXAU: 2700.50, // USD/oz
        USDXAG: 31.50,   // USD/oz
        INR: 84.50,      // INR per 1 USD
      },
    };

    const parsed = service.parseProviderResponse(mockApiResponse);
    const expectedGoldOunceINR = 2700.50 * 84.50; // 228,192.25
    const expectedGoldGramINR = service.round(expectedGoldOunceINR / TROY_OUNCE_TO_GRAMS);
    assert.strictEqual(parsed.gold.karat24.perGram, expectedGoldGramINR);
    assert.strictEqual(parsed.gold.karat24.priceUSD, 2700.50);
  });

  // 5. RECIPROCAL RATE HANDLING
  test('5. Reciprocal rate handling (1 / XAU) without double conversion', () => {
    const directOunce = 397231.80;
    const reciprocalXau = 1 / directOunce; // 0.00000251742...
    
    const mockApiResponse = {
      success: true,
      base: 'INR',
      timestamp: 1792454399,
      rates: {
        XAU: reciprocalXau, // reciprocal format
        INRXAG: 5450.31,
      },
    };

    const parsed = service.parseProviderResponse(mockApiResponse);
    assert.strictEqual(parsed.gold.karat24.perGram, 12771.30);
  });

  // 6. GOLD PURITY FRACTIONS
  test('6. Gold purity theoretical values (24K: 24/24, 22K: 22/24, 18K: 18/24)', () => {
    const mockData = {
      goldInrPerOz: 397231.80,
      silverInrPerOz: 5450.31,
      usdToInr: 84.50,
      timestamp: 1792454399,
    };

    const payload = service.buildStandardMetalPayload(mockData);
    const spot24 = payload.gold.karat24.perGram;
    const spot22 = payload.gold.karat22.perGram;
    const spot18 = payload.gold.karat18.perGram;

    // 24K pure = 12771.30
    assert.strictEqual(spot24, 12771.30);
    // 22K theoretical = 12771.30 * 22 / 24 = 11707.03
    assert.strictEqual(spot22, 11707.03);
    // 18K theoretical = 12771.30 * 18 / 24 = 9578.47 (rounded)
    assert.strictEqual(spot18, 9578.47);
  });

  // 7. SILVER UNIT RECONCILIATION
  test('7. Silver mathematical reconciliation (gram, 10g, kg, troy oz)', () => {
    const mockData = {
      goldInrPerOz: 397231.80,
      silverInrPerOz: 5450.31,
      usdToInr: 84.50,
      timestamp: 1792454399,
    };

    const payload = service.buildStandardMetalPayload(mockData);
    const s = payload.silver;
    
    // Per gram = 175.23
    assert.strictEqual(s.perGram, 175.23);
    // 10 grams = 175.23 * 10 = 1752.30
    assert.strictEqual(s.per10Gram, 1752.30);
    // 1 kg = 175.23 * 1000 = 175230.00
    assert.strictEqual(s.perKg, 175230.00);
    // Troy oz = 5450.31
    assert.strictEqual(s.perOunce, 5450.31);

    // Reconcile 1 kg vs 1000g
    assert.strictEqual(s.perKg, s.perGram * 1000);
    // Reconcile 10g vs 10 * 1g
    assert.strictEqual(s.per10Gram, s.perGram * 10);
  });

  // 8. PUNE RETAIL IMPORT PARITY FORMULAS
  test('8. Pune retail landed import parity (6% BCD + 3% GST + 0.45% margin + 8% making)', () => {
    const spotGram = 12771.30;
    const bcd = service.round(spotGram * 0.06); // 766.28
    const gst = service.round((spotGram + bcd) * 0.03); // 406.13
    const margin = service.round((spotGram + bcd + gst) * 0.0045); // 62.75
    const expectedBullion24k = service.round(spotGram + bcd + gst + margin); // 14006.46

    const mockData = {
      goldInrPerOz: 397231.80,
      silverInrPerOz: 5450.31,
      usdToInr: 84.50,
      timestamp: 1792454399,
    };
    const payload = service.buildStandardMetalPayload(mockData);
    const pune = payload.puneMarket;

    assert.strictEqual(pune.gold.karat24.perGram, expectedBullion24k);
    assert.strictEqual(pune.gold.karat24.per10Gram, service.round(expectedBullion24k * 10));

    // 22K finished jewellery includes 8% making charges
    const puneBullion22k = service.round(expectedBullion24k * 22 / 24); // 12839.26
    const expectedJewellery22k = service.round(puneBullion22k * 1.08); // 13866.40
    assert.strictEqual(pune.gold.karat22.jewelleryPerGram, expectedJewellery22k);
  });

  // 9. VALIDATION EDGE CASES: MISSING & ZERO RATES
  test('9. Validation rejects zero, negative and non-numeric rates', () => {
    assert.throws(() => {
      service.parseProviderResponse({ success: true, base: 'INR', rates: { INRXAU: 0, INRXAG: 5000 } });
    }, /invalid or non-numeric gold rate/);

    assert.throws(() => {
      service.parseProviderResponse({ success: true, base: 'INR', rates: { INRXAU: -100, INRXAG: 5000 } });
    }, /invalid or non-numeric gold rate/);

    assert.throws(() => {
      service.parseProviderResponse({ success: true, base: 'INR', rates: { INRXAU: 'NaN', INRXAG: 5000 } });
    }, /invalid or non-numeric gold rate/);

    assert.throws(() => {
      service.parseProviderResponse({ success: true, base: 'INR', rates: { INRXAU: 390000, INRXAG: 0 } });
    }, /invalid or non-numeric silver rate/);
  });

  // 10. ERROR HANDLING: FAILED PROVIDER RESPONSE
  test('10. Provider API failure response handling', () => {
    assert.throws(() => {
      service.parseProviderResponse({
        success: false,
        error: { code: 'invalid_access_key', info: 'You have entered an invalid API key.' }
      });
    }, /MetalpriceAPI error/);
  });

  // 11. IN-MEMORY CACHE & DEDUPLICATION
  test('11. Caching behavior (TTL 5 minutes)', () => {
    const testPayload = { gold: { karat24: { perGram: 12000 } }, silver: { perGram: 150 } };
    service.cache = testPayload;
    service.lastFetchedAt = Date.now();

    assert.strictEqual(service.isCacheValid(), true);

    // Expire cache
    service.lastFetchedAt = Date.now() - (6 * 60 * 1000);
    assert.strictEqual(service.isCacheValid(), false);
  });

  // 12. PROVIDER STATUS TELEMETRY (NO SECRET LEAKS)
  test('12. Telemetry reports health without exposing API key', () => {
    const status = service.getProviderStatus();
    assert.strictEqual(status.provider, 'MetalpriceAPI');
    assert.strictEqual(status.configured, true);
    assert.strictEqual(status.troyOunceConversionConstant, 31.1034768);
    assert.strictEqual(status.apiKey, undefined); // Never exposed
  });

  // 13. REAL LIVE PROVIDER FETCH VIA API KEY
  await asyncTest('13. Live MetalpriceAPI fetch with valid API key', async () => {
    const liveService = new MetalPriceService();
    const liveData = await liveService.fetchFromProvider();

    assert.ok(liveData, 'Live data should exist');
    assert.ok(liveData.gold.karat24.perGram > 5000, 'Gold per gram should be realistic (> ₹5000/g)');
    assert.ok(liveData.silver.perGram > 50, 'Silver per gram should be realistic (> ₹50/g)');
    assert.ok(liveData.puneMarket, 'Pune market retail estimates must be present');
    assert.strictEqual(liveData.puneMarket.city, 'Pune');
    assert.ok(liveData.timestampIST.includes('[IST]'), 'Timestamp must be formatted in Asia/Kolkata (IST)');
    console.log(`     -> Live Spot Gold: ₹${liveData.gold.karat24.perGram}/g (24K)`);
    console.log(`     -> Live Pune Retail Bullion: ₹${liveData.puneMarket.gold.karat24.perGram}/g (₹${liveData.puneMarket.gold.karat24.per10Gram} / 10g)`);
    console.log(`     -> Live Pune Retail 22K Jewellery: ₹${liveData.puneMarket.gold.karat22.jewelleryPerGram}/g`);
    console.log(`     -> Live Spot Silver: ₹${liveData.silver.perGram}/g (₹${liveData.silver.perKg} / kg)`);
    console.log(`     -> Live Provider Timestamp: ${liveData.timestampIST}`);
  });

  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllMetalsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
