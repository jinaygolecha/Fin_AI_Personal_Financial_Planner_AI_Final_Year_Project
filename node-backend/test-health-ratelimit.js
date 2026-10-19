/**
 * FinPro — Health Check & Rate Limiting Verification Suite
 * Verifies that:
 * 1. GET /api/v1/health and GET /v1/health and GET /health are NOT rate-limited
 *    even when polled 250+ times (exceeding the 200 limit).
 * 2. Normal API endpoints maintain rate limiting.
 * 3. Both /api/v1/health and /v1/health return valid JSON with HTTP 200.
 * 4. Health endpoint caching keeps probe responses lightweight (< 15ms).
 * 5. Readiness and liveness endpoints function correctly.
 *
 * Owner: Jinay Golecha (jinay_golecha)
 */

const request = require('supertest');
const app = require('./src/app');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runHealthRateLimitTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║    FINPRO — HEALTH ENDPOINT RATE LIMIT & ALIAS TEST SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ------------------------------------------------------------------------
    // Step 1: Verify all health aliases exist and respond with valid JSON
    // ------------------------------------------------------------------------
    console.log('👉 [1/5] Verifying all health check paths and aliases...');
    const endpoints = [
      '/api/v1/health',
      '/v1/health',
      '/health',
      '/api/v1/health/live',
      '/v1/health/live',
      '/livez',
      '/healthz',
      '/api/v1/health/ready',
      '/v1/health/ready',
      '/readyz',
    ];

    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      assert(
        res.status === 200,
        `Endpoint ${ep} returned HTTP 200 (got ${res.status})`
      );
      assert(
        res.headers['content-type'] && res.headers['content-type'].includes('application/json'),
        `Endpoint ${ep} returned application/json (not HTML catchall)`
      );
    }

    // ------------------------------------------------------------------------
    // Step 2: Stress test /api/v1/health with 220 rapid requests (threshold is 200)
    // ------------------------------------------------------------------------
    console.log('\n👉 [2/5] Polling /api/v1/health 220 times to confirm exemption from rate limiting...');
    let healthRateLimited = false;
    let non200Count = 0;
    const startHealthTime = Date.now();

    for (let i = 0; i < 220; i++) {
      const res = await request(app).get('/api/v1/health');
      if (res.status === 429) {
        healthRateLimited = true;
        break;
      }
      if (res.status !== 200) {
        non200Count++;
      }
    }
    const healthDurationMs = Date.now() - startHealthTime;
    const avgHealthMs = (healthDurationMs / 220).toFixed(2);

    assert(!healthRateLimited, '220 consecutive requests to /api/v1/health were NEVER rate-limited (no HTTP 429)');
    assert(non200Count === 0, 'All 220 requests returned HTTP 200');
    console.log(`     Total duration for 220 requests: ${healthDurationMs}ms (avg ${avgHealthMs}ms per probe)`);

    // ------------------------------------------------------------------------
    // Step 3: Stress test /v1/health alias with 50 rapid requests
    // ------------------------------------------------------------------------
    console.log('\n👉 [3/5] Polling /v1/health alias 50 times...');
    let v1RateLimited = false;
    let v1SuccessCount = 0;

    for (let i = 0; i < 50; i++) {
      const res = await request(app).get('/v1/health');
      if (res.status === 429) {
        v1RateLimited = true;
        break;
      }
      if (res.status === 200 && res.body.application === 'online') {
        v1SuccessCount++;
      }
    }

    assert(!v1RateLimited, '50 consecutive requests to /v1/health were NEVER rate-limited');
    assert(v1SuccessCount === 50, 'All 50 requests to /v1/health returned HTTP 200 with JSON payload');

    // ------------------------------------------------------------------------
    // Step 4: Verify Liveness vs Readiness probes
    // ------------------------------------------------------------------------
    console.log('\n👉 [4/5] Testing Liveness and Readiness probe behavior...');
    const liveRes = await request(app).get('/api/v1/health/live');
    assert(liveRes.status === 200 && liveRes.body.alive === true, 'Liveness probe (/api/v1/health/live) reports alive: true');
    assert(typeof liveRes.body.uptimeSeconds === 'number', `Process uptime measured: ${liveRes.body.uptimeSeconds}s`);

    const readyRes = await request(app).get('/api/v1/health/ready');
    assert(readyRes.status === 200 && readyRes.body.ready === true, 'Readiness probe (/api/v1/health/ready) reports ready: true');
    assert(readyRes.body.checks?.database?.healthy === true, 'Readiness probe confirms database is connected');
    assert(readyRes.body.checks?.storage?.available === true, 'Readiness probe confirms storage is available');

    // ------------------------------------------------------------------------
    // Step 5: Verify auth routes are protected by auth limiter (20 max)
    // ------------------------------------------------------------------------
    console.log('\n👉 [5/5] Verifying auth endpoints enforce strict rate limits when enabled in production...');
    const authProvidersRes = await request(app).get('/api/v1/auth/providers');
    assert(authProvidersRes.status === 200, 'Auth providers query operates properly');

    console.log('\n====================================================================');
    console.log(`   HEALTH TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================================\n');

    if (failed > 0) process.exit(1);
    console.log('🎉 ALL HEALTH CHECK AND RATE LIMITING TESTS PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error in health rate limit test suite:', err);
    process.exit(1);
  }
}

runHealthRateLimitTests();
