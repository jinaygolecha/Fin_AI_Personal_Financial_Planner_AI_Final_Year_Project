# Jinay Finance AI — Critical Repair Report

**Owner:** Jinay Golecha (`jinay_golecha`)  
**Project:** Jinay Finance AI — AI-Powered Personal Finance & Investment Advisor  
**Academic Context:** Final Year Engineering Project  
**Local Project Path:** `E:\FINAL_YEAR_PROJECT\Minor Project\Final-Year-Project`  
**Execution Environment:** Node.js v22 · Express.js v4.21 · PostgreSQL 17 · Prisma ORM v5.22  
**Date:** 2026-08-16  

---

## 🛠️ Feature Failure & Repair Matrix

| Feature | Frontend | API Endpoint | Backend Controller | DB Table | Status | Root Cause / Resolution |
|---|---|---|---|---|---|---|
| **Signup** | `signup.html` | `POST /api/v1/auth/register` | `authController.register` | `User`, `Profile`, `FinancialAccount` | **`PASS`** | Previously allowed unhandled exceptions on duplicate email; added clean 409 conflict and password hashing with bcrypt (12 rounds). |
| **Login** | `login.html` | `POST /api/v1/auth/login` | `authController.login` | `User`, `RefreshToken` | **`PASS`** | Previously returned 500 on wrong credentials; added clean 401 response and DB refresh token issuance. |
| **Logout** | `sidebar.js` | `POST /api/v1/auth/logout` | `authController.logout` | `RefreshToken` | **`PASS`** | Client cleared local storage without DB token revocation; wired server-side token deletion from `refresh_tokens`. |
| **Google Login** | `login.html` | `GET /api/v1/auth/google`, `POST /api/v1/auth/google/token` | `authController.googleAuthRedirect`, `authController.googleTokenAuth` | `User`, `Profile` | **`PASS`** | Missing client ID previously crashed the server; wrapped in structured 503 fallback and server-side OAuth2 code exchange. |
| **Dashboard** | `dashboard.html`| `GET /api/v1/dashboard` | `dashboardController.getDashboard` | `Transaction`, `FinancialAccount`, `Goal`, `Loan` | **`PASS`** | Frontend was displaying hardcoded demo numbers; now calculates real-time metrics dynamically from PostgreSQL 17. |
| **Transactions** | `transactions.html` | `GET`, `POST`, `PATCH`, `DELETE /api/v1/transactions` | `transactionController` | `Transaction`, `FinancialAccount`, `AuditLog` | **`PASS`** | Deletions did not revert account balances; added atomic transaction reverting balances and statistical anomaly detection. |
| **Budget** | `budget.html` | `GET`, `POST`, `PATCH`, `DELETE /api/v1/budgets` | `budgetController` | `Budget`, `Transaction` | **`PASS`** | Spending was calculated client-side; backend now performs monthly aggregations and 50/30/20 budget optimization. |
| **Goals** | `goals.html` | `GET`, `POST`, `PATCH /api/v1/goals/:id/contribute` | `goalController`, `aiController.forecastGoalCompletion` | `Goal` | **`PASS`** | Goal forecasting was missing; added AI milestone completion predictor with inflation adjustments. |
| **Investments** | `investments.html` | `GET`, `POST /api/v1/investments/buy`, `GET /portfolio` | `investmentController` | `Investment`, `Portfolio` | **`PASS`** | Holdings were static; wired real-time P&L calculation against live market quotes and MCX metal feeds. |
| **AI Advisor** | `ai-advisor.html` | `POST /api/v1/ai/chat` | `aiController.chat` | `ChatMessage`, `FinancialAccount`, `Transaction` | **`PASS`** | AI previously received zero user context; now dynamically aggregates user's accounts, spending, and loans from PostgreSQL into Gemini prompt. |
| **Voice Assistant** | `ai-advisor.html`, `dashboard.html` | `POST /api/v1/ai/voice-intent` | `aiController.parseVoiceIntent` | `Transaction` | **`PASS`** | Microphone button did not parse intents and lacked safety checks; implemented Web Speech API with mandatory user confirmation dialogs. |
| **Market Data** | `investments.html`, `dashboard.html` | `GET /api/v1/market/quote`, `GET /history`, `GET /search` | `marketController` | In-memory TTL Cache | **`PASS`** | Random generated stock prices removed; integrated Finnhub API with honest status headers (`LIVE`, `DELAYED`, `CACHED`). |
| **Gold Market** | `investments.html`, `dashboard.html` | `GET /api/v1/market/metals`, `GET /gold` | `marketController.getMetals` | In-memory TTL Cache | **`PASS`** | Hardcoded ₹7,480 removed; connected live/reference MCX 24K and 22K Gold feeds in INR with timestamps. |
| **Silver Market** | `investments.html`, `dashboard.html` | `GET /api/v1/market/metals`, `GET /silver` | `marketController.getMetals` | In-memory TTL Cache | **`PASS`** | Hardcoded ₹92.50 removed; connected live/reference MCX Silver feeds in INR (₹/g, ₹/kg, ₹/oz). |
| **Loans & EMI** | `loans.html` | `GET`, `POST /api/v1/loans`, `POST /prepayment-simulate` | `loanController` | `Loan` | **`PASS`** | Delete action previously showed dummy toast; wired `DELETE /api/v1/loans/:id` and prepayment tenure reduction simulator. |
| **Insurance** | `insurance.html` | `GET`, `POST`, `DELETE /api/v1/insurance` | `insuranceController`, `aiController.getInsuranceReview` | `InsurancePolicy` | **`PASS`** | AI coverage review was missing; integrated 10x annual income coverage benchmarking and annual premium rollup. |
| **Subscriptions**| `insurance.html` | `GET`, `POST`, `DELETE /api/v1/subscriptions` | `subscriptionController` | `Subscription` | **`PASS`** | Subscriptions were disconnected; wired monthly expense rollups and next billing date calendar sync. |
| **Calendar** | `calendar.html` | `GET`, `POST /api/v1/calendar/events` | `calendarController` | `CalendarEvent` | **`PASS`** | Events were not persisted; backed by PostgreSQL with automatic aggregation of loan EMIs, SIPs, and renewals. |
| **Notifications**| `dashboard.html` | `GET /api/v1/notifications`, `POST /read-all` | `notificationController` | `Notification` | **`PASS`** | Notifications were client-side; backend now triggers DB notifications for budget overages, anomalies, and goal milestones. |
| **OCR Receipts** | `ai-advisor.html` | `POST /api/v1/receipts/scan`, `POST /confirm` | `receiptController` | `ReceiptScan`, `Transaction` | **`PASS`** | OCR scans automatically committed without review; implemented preview modal requiring explicit user confirmation. |
| **Export CSV** | `transactions.html`, `insurance.html`, `analytics.html` | `GET /api/v1/export/*.csv` | `exportController` | `Transaction`, `InsurancePolicy`, `Summary` | **`PASS`** | Direct download links failed with 401; updated auth middleware to accept both Bearer headers and `?token=` query parameters. |

---

## 🔒 Architectural Principles Enforced

1. **PostgreSQL as Single Source of Truth**: No local storage or in-memory arrays as authoritative financial records.
2. **Strict Multi-Tenant Isolation**: Every database query filters by verified JWT `req.user.id`.
3. **Monetary Precision**: Prisma `@db.Decimal(15, 2)` or `@db.Decimal(15, 6)` across all financial entities.
4. **Action Confirmation Safety**: Destructive operations, voice entry mutations, and OCR scans require user confirmation before database commit.
