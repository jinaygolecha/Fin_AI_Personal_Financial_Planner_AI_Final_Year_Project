# FinPro — Cloud Failure & Resiliency Verification

This document details the **Failure Testing Methodology**, simulated outage scenarios, expected transitions, and automated verification results for the FinPro cloud platform.

---

## 1. Objectives of Cloud Failure Testing

In distributed cloud architectures, individual subsystems will inevitably experience network partitions, latency spikes, or temporary downtime. A production-ready system must:
1. **Detect failures immediately** using lightweight, non-blocking probes.
2. **Transition state honestly** from `HEALTHY` to `DEGRADED` without reporting false positives.
3. **Fail fast on readiness**: Return `HTTP 503 Service Unavailable` on `/ready` so reverse proxies (Nginx) and orchestrators (Docker/Kubernetes) stop routing incoming traffic to compromised replicas.
4. **Prevent application crashes**: Handle unhandled promise rejections and keep frontend static assets online even if backend stores are unreachable.
5. **Recover automatically**: Instantly restore `HTTP 200 OK` once network connectivity or credentials are restored.

---

## 2. Tested Failure Scenarios

| Scenario | Simulated Condition | Expected Response | Observed Status |
|:---|:---|:---|:---|
| **1. Baseline State** | All subsystems connected & healthy | `/health` -> 200 OK<br>`/ready` -> 200 (ready=true) | ✅ PASS (200 OK) |
| **2. Database Outage** | Cloud PostgreSQL timeout / connection drop | `/health` -> 503 (degraded)<br>`/database` -> 503 (disconnected)<br>`/ready` -> 503 (ready=false) | ✅ PASS (503 Service Unavailable) |
| **3. Frontend Resilience** | Database down while user visits landing/status | Landing page (`/`) -> 200 OK<br>Status UI (`/status.html`) -> 200 OK | ✅ PASS (Static assets survive) |
| **4. Storage Provider Outage** | S3 bucket permissions revoked / network timeout | `/health/storage` -> 503 (error)<br>`/ready` -> 503 (ready=false) | ✅ PASS (503 Service Unavailable) |
| **5. Path Traversal Attack** | Malicious storage key traversal (`../../../etc/passwd`) | `/storage/file/...` -> 400 / 401 / 404 | ✅ PASS (Blocked securely) |
| **6. System Recovery** | Connectivity restored to PostgreSQL & Storage | `/health` -> 200 OK<br>`/ready` -> 200 (ready=true) | ✅ PASS (Automatic recovery) |

---

## 3. Automated Test Execution

The failure scenarios are codified in [`node-backend/test-cloud-failure.js`](../../node-backend/test-cloud-failure.js) and can be executed at any time:

```bash
npm run test:failure
```

*Execution Output:*
```
╔════════════════════════════════════════════════════════════════════╗
║        FINPRO — CLOUD FAILURE & RESILIENCY TEST SUITE             ║
╚════════════════════════════════════════════════════════════════════╝

👉 [Scenario 1/6] Verifying Baseline Healthy State...
  ✅ [PASS] Baseline /health returns HTTP 200
  ✅ [PASS] Baseline /health/ready returns HTTP 200 with ready=true

👉 [Scenario 2/6] Simulating Cloud Database Outage...
  ✅ [PASS] GET /api/v1/health returns HTTP 503 during database outage
  ✅ [PASS] System status correctly transitions to "degraded"
  ✅ [PASS] Database is explicitly reported as "disconnected"
  ✅ [PASS] GET /api/v1/health/database returns HTTP 503
  ✅ [PASS] Database probe reports healthy=false
  ✅ [PASS] Readiness probe returns HTTP 503 (prevents routing client traffic to degraded container)
  ✅ [PASS] Readiness probe reports ready=false

👉 [Scenario 3/6] Verifying Frontend Availability During Backend Degradation...
  ✅ [PASS] Landing page remains available (HTTP 200) without crashing
  ✅ [PASS] Cloud Status UI remains accessible (HTTP 200) so operators can view telemetry

👉 [Scenario 4/6] Simulating Storage Provider Failure...
  ✅ [PASS] GET /api/v1/health/storage returns HTTP 503 on storage failure
  ✅ [PASS] Storage probe reports available=false
  ✅ [PASS] Readiness probe returns HTTP 503 when storage subsystem is down

👉 [Scenario 5/6] Testing Malformed Request & Directory Traversal Protection...
  ✅ [PASS] Directory traversal path blocked securely

👉 [Scenario 6/6] Verifying Full System Recovery...
  ✅ [PASS] GET /api/v1/health recovered to HTTP 200 (healthy)
  ✅ [PASS] Readiness probe recovered to HTTP 200 (ready=true)

====================================================================
  FAILURE TEST RESULTS: 17 PASSED | 0 FAILED
====================================================================
🎉 ALL CLOUD FAILURE MODES AND RESILIENCY CHECKS PASSED!
```
