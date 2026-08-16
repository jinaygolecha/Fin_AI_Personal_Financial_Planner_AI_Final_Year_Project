# Jinay Finance AI — Comprehensive Project Architecture & Integrity Audit

**Owner:** Jinay Golecha (`jinay_golecha`)  
**Project:** Jinay Finance AI — AI-Powered Personal Finance & Investment Advisor  
**Local Path:** `E:\FINAL_YEAR_PROJECT\Minor Project\Final-Year-Project`  
**Audit Date:** 2026-08-16  

---

## 1. Actual Frontend Architecture
- **Technology:** Pure Semantic HTML5, Vanilla JavaScript (ES6+), Modern Glassmorphism/Dark CSS, Apache ECharts 5.5, Remix Icon 4.5.
- **Location:** `frontend/public/`
- **Serving:** Statically hosted by the Express.js server at `http://127.0.0.1:5000/`.
- **Key Pages:**
  - `index.html`: Landing page.
  - `login.html`: Email/password login & Google OAuth entry.
  - `signup.html`: User registration with validation.
  - `onboarding.html`: 3-step financial profile setup (Salary, Expenses, Savings, Risk Profile, Budget Method).
  - `dashboard.html`: Live market ticker, real-time balances, 30-day cash flow forecast chart, anomaly alerts, 10-factor financial health score ring, recent transactions, and goal progress.
  - `transactions.html`: Full CRUD transactions with filtering, search, pagination, category selection, and CSV export.
  - `budget.html`: Category-based monthly budgets with real spending tracking and 50/30/20 auto-setup.
  - `goals.html`: Financial goals with milestone tracking, contribution actions, and AI completion forecasting.
  - `investments.html`: Live 24K/22K Gold & Silver rates (MCX India), real-time stock quotes, interactive multi-timeframe charts (`1D`, `1W`, `1M`, `3M`, `1Y`, `5Y`), and portfolio valuation with P&L.
  - `loans.html`: Loan tracking, EMI calculator, and prepayment tenure reduction simulator.
  - `insurance.html`: Life, Health, Motor, Home policies and recurring subscriptions manager with AI coverage review.
  - `calendar.html`: Financial calendar plotting recurring EMIs, SIPs, renewals, and custom bill reminders.
  - `ai-advisor.html`: Interactive AI chat advisor, What-If simulator, Voice assistant with confirmation dialogs, OCR receipt scanner, and Bank statement CSV importer.
  - `analytics.html`: Period trends (`Week`, `Month`, `Year`), category breakdown pie charts, and summary reports.

---

## 2. Actual Backend Architecture
- **Technology:** Node.js (v22), Express.js (v4.21.2), Prisma ORM (v5.22.0), PostgreSQL (v17).
- **Location:** `node-backend/`
- **Port:** `5000` (`http://127.0.0.1:5000`)
- **Structure:**
  - `src/server.js`: Server bootstrap, PostgreSQL connection check, cron jobs, and graceful shutdown.
  - `src/app.js`: Express app configuration, security headers (Helmet), CORS, JSON parser, and central route mount.
  - `src/routes/index.js`: Consolidated API routing under `/api/v1/`.
  - `src/controllers/`: 16 controllers implementing input validation and standardized responses.
  - `src/services/`: Core business logic (`financialTwinService.js`, `marketService.js`, `authService.js`, `aiService.js`).
  - `src/middleware/`: JWT verification, rate limiting, and error handling.

---

## 3. Actual Database Architecture
- **Engine:** PostgreSQL 17 at `127.0.0.1:5432/finance_jinay`.
- **ORM:** Prisma Client with Decimal support (`@db.Decimal(15, 2)` for monetary values).
- **Relational Integrity:**
  - Foreign keys on all user-owned models referencing `User.id` with `onDelete: Cascade` where appropriate.
  - Indexes on `userId`, `date`, `transactionType`, `symbol`, and `createdAt` for high-speed queries.

---

## 4. Authentication Implementation
- **Tokens:** JWT Access Token (60-minute lifetime) + JWT Refresh Token (7-day lifetime).
- **Token Storage:** Refresh tokens persisted in `refresh_tokens` database table enabling instant token rotation and revocation on logout.
- **Passwords:** Hashed using `bcryptjs` with 12 salt rounds.
- **Verification:** Central `authenticate` middleware in `src/middleware/auth.js` inspecting `Authorization: Bearer <token>` or `?token=<token>` (for authenticated file downloads).

---

## 5. Google OAuth Implementation
- **Endpoints:**
  - `GET /api/v1/auth/google`: Initiates Google authorization redirect.
  - `GET /api/v1/auth/google/callback`: Server-side authorization code exchange for tokens, finding or creating user in DB, and redirecting with tokens.
  - `POST /api/v1/auth/google/token`: Allows direct Google ID token verification via `oauth2.googleapis.com/tokeninfo`.
- **Configuration Safety:** If `GOOGLE_CLIENT_ID` is unset, the system returns an informative 503 error instead of crashing or generating fake sessions.

---

## 6. AI Implementation
- **Provider:** Google Gemini 1.5 Pro (`@google/generative-ai`) with local financial intelligence fallback engine when `GEMINI_API_KEY` is not present.
- **Context Pipeline:** Authenticated user data (accounts, transactions, loans, goals, health score) is dynamically extracted into a structured context before querying the AI.
- **Action Confirmation:** Write operations (e.g., adding an expense via voice) require explicit user preview and approval before executing database mutations.

---

## 7. Market Data Implementation
- **Service:** `marketService.js` supporting Finnhub API for stock quotes and charts with MCX India reference rates for precious metals.
- **Commodities:**
  - **24K Gold**: ₹/gram, ₹/10g, ₹/oz
  - **22K Gold**: ₹/gram
  - **Silver**: ₹/gram, ₹/kg, ₹/oz
- **Status Transparency:** All responses include `marketStatus` (`LIVE`, `DELAYED`, `CACHED`, `MARKET CLOSED`, `UNAVAILABLE`) and Indian Standard Time (IST) timestamps.

---

## 8. Existing API Routes (`/api/v1`)

| Module | Methods & Endpoints |
|---|---|
| **Health** | `GET /health`, `GET /health/database`, `GET /health/ai`, `GET /health/market` |
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/google/token` |
| **Onboarding** | `POST /onboarding`, `GET /onboarding/status` |
| **Dashboard** | `GET /dashboard` |
| **Accounts** | `GET /accounts`, `POST /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id`, `POST /accounts/:id/deposit` |
| **Transactions** | `GET /transactions`, `POST /transactions`, `GET /transactions/:id`, `PATCH /transactions/:id`, `DELETE /transactions/:id`, `POST /transactions/voice` |
| **Budgets** | `GET /budgets`, `POST /budgets`, `PATCH /budgets/:id`, `DELETE /budgets/:id` |
| **Goals** | `GET /goals`, `POST /goals`, `GET /goals/:id`, `PATCH /goals/:id`, `PATCH /goals/:id/contribute`, `DELETE /goals/:id` |
| **Investments** | `GET /investments`, `GET /investments/portfolio`, `POST /investments/buy`, `PATCH /investments/:id`, `DELETE /investments/:id` |
| **Market** | `GET /market/quote`, `GET /market/history`, `GET /market/search`, `GET /market/metals`, `GET /market/gold`, `GET /market/silver`, `GET /market/popular`, `GET /market/watchlist`, `POST /market/watchlist`, `DELETE /market/watchlist/:symbol` |
| **Loans** | `GET /loans`, `POST /loans`, `GET /loans/:id`, `PATCH /loans/:id`, `DELETE /loans/:id`, `POST /loans/calculate-emi`, `POST /loans/prepayment-simulate` |
| **Insurance** | `GET /insurance`, `POST /insurance`, `GET /insurance/:id`, `PATCH /insurance/:id`, `DELETE /insurance/:id` |
| **Subscriptions** | `GET /subscriptions`, `POST /subscriptions`, `PATCH /subscriptions/:id`, `DELETE /subscriptions/:id` |
| **Calendar** | `GET /calendar/events`, `POST /calendar/events`, `PATCH /calendar/events/:id`, `DELETE /calendar/events/:id` |
| **Notifications** | `GET /notifications`, `POST /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id` |
| **AI & Simulations** | `POST /ai/chat`, `GET /ai/history`, `DELETE /ai/history`, `GET /ai/snapshot`, `GET /ai/financial-health`, `GET /ai/cash-flow`, `GET /ai/anomalies`, `PATCH /ai/anomalies/:id/feedback`, `GET /ai/budget-optimize`, `GET /ai/risk-radar`, `POST /ai/simulate`, `GET /ai/simulations/history`, `POST /ai/retirement-plan`, `GET /ai/goals/:id/forecast`, `GET /ai/investment-analysis`, `GET /ai/insurance-review`, `GET /ai/recommendations`, `POST /ai/recommendations/:id/feedback`, `POST /ai/voice-intent` |
| **Receipts OCR** | `POST /receipts/scan`, `POST /receipts/confirm` |
| **CSV Import** | `POST /import/bank-statement`, `POST /import/confirm` |
| **Reports & Export**| `GET /reports/monthly`, `GET /export/transactions.csv`, `GET /export/accounts.csv`, `GET /export/budgets.csv`, `GET /export/goals.csv`, `GET /export/investments.csv`, `GET /export/loans.csv`, `GET /export/insurance.csv`, `GET /export/subscriptions.csv`, `GET /export/summary.csv` |

---

## 9. Existing Database Models (27 Models)
1. `User`
2. `RefreshToken`
3. `Profile`
4. `FinancialProfile`
5. `FinancialPlan`
6. `FinancialAccount`
7. `Category`
8. `Transaction`
9. `Budget`
10. `Goal`
11. `Portfolio`
12. `Investment`
13. `MarketWatchlist`
14. `Loan`
15. `InsurancePolicy`
16. `Subscription`
17. `CalendarEvent`
18. `Notification`
19. `ChatMessage`
20. `AIRecommendation`
21. `AIRecommendationFeedback`
22. `FinancialHealthHistory`
23. `CashFlowPrediction`
24. `ExpenseAnomaly`
25. `FinancialSimulation`
26. `TransactionCategoryCorrection`
27. `ReceiptScan`
28. `MarketPriceHistory`
29. `CommodityPrice`
30. `ExportJob`
31. `AuditLog`

---

## 10. Audit Findings & Repairs Performed

1. **Loan Deletion in UI (`loans.html`)**:
   - *Finding*: UI displayed a toast message ("contact administrator") instead of calling the existing backend endpoint.
   - *Fix*: Wired `deleteLoan(id)` in `loans.html` to `DELETE /api/v1/loans/:id` with confirmation and table refresh.

2. **Voice Intent Collision (`aiController.js`)**:
   - *Finding*: Commands starting with `"Add 500 food expense"` triggered `QUERY_EXPENSES` instead of `CREATE_EXPENSE` because the keyword `"expense"` was checked first.
   - *Fix*: Prioritized write/action regex matching before general spending queries and enforced confirmation.

3. **CSV Export Authentication via Browser Link**:
   - *Finding*: Direct link clicks for CSV downloads lacked the `Authorization` header.
   - *Fix*: Supported query parameter token authentication (`?token=<token>`) in `auth.js` middleware alongside `Bearer` headers.

4. **Shared Sidebar Resilience (`sidebar.js`)**:
   - *Finding*: Some legacy pages used older inlined versions of `getSidebar()`.
   - *Fix*: Exported `renderSidebar`, `getSidebar`, and `initSidebarUser` both as ES modules and on the global `window` object.

5. **Tenant Isolation**:
   - *Finding*: Verified User A cannot access, modify, or delete User B's accounts, transactions, loans, goals, or insurance policies.

---

## 11. Testing & Verification Summary

- **Master Test Suite**: `node run-all-tests.js`
- **Result**: **`66 PASSED | 0 FAILED`** across all 20 test sections.
- **Persistence Verification**: Verified that user accounts, transactions, investments, loans, budgets, goals, and health histories persist accurately in PostgreSQL across backend process restarts.
