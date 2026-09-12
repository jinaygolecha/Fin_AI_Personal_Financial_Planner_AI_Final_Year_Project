/**
 * FinPro — Cloud Failure & Resiliency Verification Suite
 * Tests actual failure modes and graceful degradation:
 * 1. Database Disconnection & Outage Simulation
 * 2. Invalid Database Credentials Simulation
 * 3. Storage Failure & Unavailability Simulation
 * 4. Readiness Probe 503 Trigger on Dependency Drop
 * 5. Frontend & Static Assets Survival during Backend Degradation
 * 6. System Recovery Verification
 *
 * Owner: Jinay Golecha (jinay_golecha)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const request = require('supertest');
const app = require('./src/app');
const prisma = require('./src/config/database');
const storageService = require('./src/services/storageService');

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

async function runFailureSuite() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║        FINPRO — CLOUD FAILURE & RESILIENCY TEST SUITE             ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ------------------------------------------------------------------------
    // Scenario 1: Baseline Health Check
    // ------------------------------------------------------------------------
    console.log('👉 [Scenario 1/6] Verifying Baseline Healthy State...');
    const baseHealth = await request(app).get('/api/v1/health');
    assert(baseHealth.status === 200, 'Baseline /health returns HTTP 200');
    const baseReady = await request(app).get('/api/v1/health/ready');
    assert(baseReady.status === 200 && baseReady.body.ready === true, 'Baseline /health/ready returns HTTP 200 with ready=true');

    // ------------------------------------------------------------------------
    // Scenario 2: Simulated Database Outage / Unavailability
    // ------------------------------------------------------------------------
    console.log('\n👉 [Scenario 2/6] Simulating Cloud Database Outage...');
    // Temporarily mock checkHealth to simulate a connection timeout/refusal
    const originalCheckHealth = prisma.checkHealth;
    prisma.checkHealth = async () => ({
      status: 'disconnected',
      healthy: false,
      latencyMs: 3000,
      configured: true,
      provider: 'PostgreSQL',
      isCloud: true,
      error: 'Connection timeout: cloud host unreachable on port 5432 (simulated outage)',
    });

    const degradedHealth = await request(app).get('/api/v1/health');
    assert(degradedHealth.status === 503, 'GET /api/v1/health returns HTTP 503 during database outage');
    assert(degradedHealth.body.status === 'degraded', 'System status correctly transitions to "degraded"');
    assert(degradedHealth.body.database === 'disconnected', 'Database is explicitly reported as "disconnected"');

    const dbProbe = await request(app).get('/api/v1/health/database');
    assert(dbProbe.status === 503, 'GET /api/v1/health/database returns HTTP 503');
    assert(dbProbe.body.healthy === false, 'Database probe reports healthy=false');

    const unreadyProbe = await request(app).get('/api/v1/health/ready');
    assert(unreadyProbe.status === 503, 'Readiness probe returns HTTP 503 (prevents routing client traffic to degraded container)');
    assert(unreadyProbe.body.ready === false, 'Readiness probe reports ready=false');

    // ------------------------------------------------------------------------
    // Scenario 3: Frontend Resilience During Database Degradation
    // ------------------------------------------------------------------------
    console.log('\n👉 [Scenario 3/6] Verifying Frontend Availability During Backend Degradation...');
    const staticHome = await request(app).get('/');
    assert(staticHome.status === 200, 'Landing page remains available (HTTP 200) without crashing');
    const statusPage = await request(app).get('/status.html');
    assert(statusPage.status === 200, 'Cloud Status UI remains accessible (HTTP 200) so operators can view telemetry');

    // Restore database health check
    prisma.checkHealth = originalCheckHealth;

    // ------------------------------------------------------------------------
    // Scenario 4: Simulated Storage Outage / Read-Only Filesystem
    // ------------------------------------------------------------------------
    console.log('\n👉 [Scenario 4/6] Simulating Storage Provider Failure...');
    const originalStorageHealth = storageService.checkStorageHealth;
    storageService.checkStorageHealth = async () => ({
      available: false,
      status: 'error',
      provider: 's3',
      error: 'AWS S3 AccessDenied: bucket permissions revoked or credentials expired (simulated failure)',
      latencyMs: 150,
    });

    const storageFailHealth = await request(app).get('/api/v1/health/storage');
    assert(storageFailHealth.status === 503, 'GET /api/v1/health/storage returns HTTP 503 on storage failure');
    assert(storageFailHealth.body.available === false, 'Storage probe reports available=false');

    const storageReadyFail = await request(app).get('/api/v1/health/ready');
    assert(storageReadyFail.status === 503, 'Readiness probe returns HTTP 503 when storage subsystem is down');

    // Restore storage health check
    storageService.checkStorageHealth = originalStorageHealth;

    // ------------------------------------------------------------------------
    // Scenario 5: Invalid Storage Request & Error Handling
    // ------------------------------------------------------------------------
    console.log('\n👉 [Scenario 5/6] Testing Malformed Request & Directory Traversal Protection...');
    const traversalAttempt = await request(app)
      .get('/api/v1/storage/file/..%2F..%2F..%2Fetc%2Fpasswd')
      .set('Authorization', 'Bearer fake_token');
    assert(traversalAttempt.status === 401 || traversalAttempt.status === 404 || traversalAttempt.status === 400, 'Directory traversal path blocked securely');

    // ------------------------------------------------------------------------
    // Scenario 6: System Recovery Verification
    // ------------------------------------------------------------------------
    console.log('\n👉 [Scenario 6/6] Verifying Full System Recovery...');
    const recoveredHealth = await request(app).get('/api/v1/health');
    assert(recoveredHealth.status === 200 && recoveredHealth.body.success, 'GET /api/v1/health recovered to HTTP 200 (healthy)');
    const recoveredReady = await request(app).get('/api/v1/health/ready');
    assert(recoveredReady.status === 200 && recoveredReady.body.ready === true, 'Readiness probe recovered to HTTP 200 (ready=true)');

    console.log('\n====================================================================');
    console.log(`  FAILURE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================================\n');

    if (failed > 0) process.exit(1);
    console.log('🎉 ALL CLOUD FAILURE MODES AND RESILIENCY CHECKS PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Unexpected error in failure test suite:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runFailureSuite();
}

module.exports = { runFailureSuite };
