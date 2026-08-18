# Jinay Finance AI — Automated & Regression Testing Guide
**Owner:** Jinay Golecha (`jinay_golecha`)  
**Test Harness:** Supertest, Jest, Custom Automated Test Runners

---

## 1. Test Suite Architecture

The platform includes three distinct, rigorous testing suites to ensure end-to-end reliability:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          TEST HARNESS INVENTORY                        │
├───────────────────────────────┬───────────────────────┬────────────────┤
│ Suite File                    │ Assertions / Tests    │ Focus Area     │
├───────────────────────────────┼───────────────────────┼────────────────┤
│ run-all-tests.js              │ 66 Assertions         │ Core APIs & DB │
│ test-auth-comprehensive.js    │ 40 Assertions         │ Auth & Tenants │
│ test-market-live.js           │ 6 Subsystems          │ External APIs  │
│ src/__tests__/api.test.js     │ Jest Integration Suite│ Modular Units  │
└───────────────────────────────┴───────────────────────┴────────────────┘
```

---

## 2. Executing Automated Tests

### 2.1 Master Integration & Acceptance Suite
Runs the 66-point top-to-bottom pipeline:
```bash
cd node-backend
node run-all-tests.js
```
**Coverage:**
- Health & diagnostics
- Registration, login, duplicate detection, auth/me
- Financial onboarding & baseline plan creation
- Atomic account deposits & balance sync
- Real-time dashboard KPI computations
- Transactions CRUD & automated balance reversals
- Category budgets & AI budget optimizer
- Goals & completion forecasting
- Real-time stock quotes, gold, silver, charts & portfolio valuation
- Loans & reducing-balance EMI math
- Insurance policies & subscription tracking
- 10-Factor AI health scoring
- Predictive cash flow trajectory (30 & 90 days)
- Financial what-if simulations
- Retirement corpus projection
- OCR receipt parsing & bank statement CSV import
- Voice assistant intent parsing
- Authenticated CSV file exports
- Multi-user tenant isolation (User A vs User B)

### 2.2 Security & Authentication Suite
Runs the 40-point security audit:
```bash
cd node-backend
node test-auth-comprehensive.js
```
**Coverage:**
- Registration validation matrix (weak passwords, missing fields, email normalization)
- PostgreSQL user persistence & bcrypt password hash verification
- Multi-identifier login (email or username)
- JWT validation, expiration, and malformed token rejection
- Refresh token issuance and revocation on logout
- Bearer vs Query token export authorization
- Multi-tenant data leak prevention

### 2.3 Live External Market Data Suite
Validates external communication with Alpha Vantage & Finnhub:
```bash
cd node-backend
node test-market-live.js
```
**Coverage:**
- Live Alpha Vantage stock quote extraction
- Live Finnhub crypto rates (BTC/USDT, ETH/USDT)
- MCX Gold (24K/22K) and Silver spot rate conversion
- Live market news feed (20 headlines)
- Company profile & fundamental metrics normalization

---

## 3. Negative Testing Matrix

| Scenario | Input / Action | Expected Result | Verified Status |
|---|---|---|---|
| **Weak Password** | `Password1` (<8 chars) | `400 VALIDATION_ERROR` | ✅ Verified |
| **Duplicate Email** | `jinay@test.com` | `409 EMAIL_EXISTS` | ✅ Verified |
| **Malformed JWT** | `Bearer invalid.jwt.token` | `401 INVALID_TOKEN` | ✅ Verified |
| **Expired JWT** | Expired access token | `401 TOKEN_EXPIRED` (Triggers client refresh) | ✅ Verified |
| **Revoked Refresh Token** | Token after logout | `401 TOKEN_REVOKED` | ✅ Verified |
| **Cross-Tenant Access** | User B queries User A account ID | `404 NOT_FOUND` | ✅ Verified |
| **Invalid Transaction ID** | `DELETE /transactions/non-existent-uuid` | `404 NOT_FOUND` | ✅ Verified |
| **Voice Intent Safety** | "Create expense ₹500" via voice | Returns intent with `requiresConfirmation: true` | ✅ Verified |
| **Negative Amount** | Transaction amount `-500` | Rejected by validation | ✅ Verified |
