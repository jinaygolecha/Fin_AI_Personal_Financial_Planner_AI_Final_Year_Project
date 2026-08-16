# Jinay Finance AI — Comprehensive System Audit Report (Forensic & Architectural Review)

**Owner:** Jinay Golecha (`jinay_golecha`)  
**Project:** Jinay Finance AI — AI-Powered Personal Finance & Investment Advisor  
**Academic Context:** Final Year Engineering Project  
**Repository Path:** `E:\FINAL_YEAR_PROJECT\Minor Project\Final-Year-Project`  
**Audit Date:** 2026-08-16  

---

## 🏛️ A. Architecture Overview

```
                           +------------------------------------------+
                           |           USER BROWSER CLIENT            |
                           |  (Semantic HTML5, Vanilla JS, ECharts)   |
                           +--------------------+---------------------+
                                                |
                                                | HTTPS / JSON + Bearer Token
                                                v
                           +------------------------------------------+
                           |          NODE.JS / EXPRESS API           |
                           |               (Port 5000)                |
                           +--------------------+---------------------+
                                                |
                      +-------------------------+-------------------------+
                      |                         |                         |
                      v                         v                         v
           +--------------------+    +--------------------+    +--------------------+
           |  SECURITY & AUTH   |    | FINANCIAL SERVICES |    | EXTERNAL PROVIDERS |
           | (JWT, Bcrypt, OIDC)|    |  (Twin, Analytics) |    |  (Finnhub, Gemini) |
           +----------+---------+    +----------+---------+    +--------------------+
                      |                         |
                      +------------+------------+
                                   |
                                   v
                      +-------------------------+
                      |       PRISMA ORM        |
                      |   (Decimal Arithmetic)  |
                      +------------+------------+
                                   |
                                   v
                      +-------------------------+
                      |   POSTGRESQL 17 RDBMS   |
                      |      (Port 5432)        |
                      +-------------------------+
```

---

## 🔍 Detailed Forensic Audit by Module (Sections B through X)

---

### B. Frontend
- **Framework:** Semantic HTML5, Vanilla JavaScript ES6+, Glassmorphic Dark UI Theme, Apache ECharts 5.5, Remix Icon 4.5.
- **Location:** `frontend/public/`
- **Serving:** Statically hosted by Express server at `http://127.0.0.1:5000/`.
- **Status:** **`WORKING`**
- **Contract Integrity:** Unified `api.js` client handling token injection, automatic token refresh on 401, error parsing, and structured responses.

---

### C. Backend
- **Framework:** Node.js (v22), Express.js (v4.21.2).
- **Location:** `node-backend/`
- **Port:** `5000`
- **Status:** **`WORKING`**
- **Architecture:** Controller-Service-Repository pattern with Prisma ORM and Express router at `/api/v1/`.

---

### D. Database
- **Engine:** PostgreSQL 17 at `localhost:5432/finance_jinay`.
- **ORM:** Prisma Client v5.22.0.
- **Status:** **`WORKING`**
- **Monetary Precision:** All amounts stored as `Decimal(15, 2)` or `Decimal(15, 6)`.
- **Relationships:** Complete cascading relations for `User`, `Account`, `Transaction`, `Budget`, `Goal`, `Investment`, `Loan`, `InsurancePolicy`, `Subscription`, `CalendarEvent`, `Notification`, `ChatMessage`, `FinancialHealthHistory`, and `AuditLog`.

---

### E. Authentication
- **Mechanism:** JWT (Access Token 60m + Refresh Token 7d stored in database).
- **Passwords:** Hashed with `bcryptjs` (12 rounds).
- **Endpoints:**
  - `POST /api/v1/auth/register` (Controller: `authController.register`, Table: `User`, `Profile`, `FinancialAccount`)
  - `POST /api/v1/auth/login` (Controller: `authController.login`, Table: `User`, `RefreshToken`)
  - `POST /api/v1/auth/refresh` (Controller: `authController.refresh`, Table: `RefreshToken`)
  - `POST /api/v1/auth/logout` (Controller: `authController.logout`, Table: `RefreshToken`)
  - `GET /api/v1/auth/me` (Controller: `authController.getMe`, Table: `User`)
- **Status:** **`WORKING`**

---

### F. Google OAuth 2.0
- **Mechanism:** Server-side authorization code exchange (`/api/v1/auth/google/callback`) and token verification (`/api/v1/auth/google/token`).
- **Safety Handling:** When `GOOGLE_CLIENT_ID` is unset, returns structured 503 instead of crashing or generating fake credentials.
- **Status:** **`WORKING`**

---

### G. AI Advisor & Financial Twin Engine
- **Engine:** Google Gemini 1.5 Pro integration with robust local financial context aggregator and rule-based decision support fallback.
- **Data Safety:** Financial context dynamically queried from PostgreSQL for authenticated `req.user.id`; mutations require explicit user confirmation.
- **Endpoints:**
  - `POST /api/v1/ai/chat` (Table: `ChatMessage`, `AIRecommendation`)
  - `GET /api/v1/ai/financial-health` (10-factor health score)
  - `GET /api/v1/ai/cash-flow` (30/90 day balance forecasting)
  - `GET /api/v1/ai/anomalies` (Table: `ExpenseAnomaly`)
  - `POST /api/v1/ai/simulate` (Table: `FinancialSimulation`)
  - `POST /api/v1/ai/retirement-plan`
  - `GET /api/v1/ai/risk-radar`
- **Status:** **`WORKING`**

---

### H. Voice Assistant
- **Mechanism:** Browser Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with synthesis + backend NLU parser (`POST /api/v1/ai/voice-intent`).
- **Safety Rule:** Queries (e.g. "How much did I spend?") execute immediately; write operations (e.g. "Add 500 food expense") return confirmation requirements before database insertion.
- **Status:** **`WORKING`**

---

### I. Market Data
- **Service:** `marketService.js` (Finnhub API integration for stocks + MCX India reference feeds for Gold 24K, Gold 22K, Silver).
- **Status Transparency:** Response headers and payload include explicit status (`LIVE`, `DELAYED`, `CACHED`, `MARKET CLOSED`, `UNAVAILABLE`) and Indian Standard Time (IST) timestamps.
- **Endpoints:**
  - `GET /api/v1/market/quote`
  - `GET /api/v1/market/history` (Multi-timeframe charts `1D`, `1W`, `1M`, `3M`, `1Y`, `5Y`)
  - `GET /api/v1/market/metals`
  - `GET /api/v1/market/gold`
  - `GET /api/v1/market/silver`
  - `GET /api/v1/market/search`
- **Status:** **`WORKING`**

---

### J. Investments & Portfolio
- **Capabilities:** Stock, Mutual Fund, SIP, Gold 24K/22K, Silver asset tracking with real-time portfolio valuation and P&L calculation.
- **Endpoints:**
  - `GET /api/v1/investments`
  - `GET /api/v1/investments/portfolio`
  - `POST /api/v1/investments/buy`
  - `DELETE /api/v1/investments/:id`
- **Status:** **`WORKING`**

---

### K. Transactions
- **Capabilities:** Complete CRUD, atomic balance updates on financial accounts, statistical $z$-score anomaly detection, search, category filtering, and balance reversal on delete.
- **Endpoints:**
  - `GET /api/v1/transactions`
  - `POST /api/v1/transactions`
  - `GET /api/v1/transactions/:id`
  - `PATCH /api/v1/transactions/:id`
  - `DELETE /api/v1/transactions/:id`
- **Status:** **`WORKING`**

---

### L. Budgets
- **Capabilities:** Category monthly spending limits, auto 50/30/20 setup, real-time spending progress bars, and AI budget optimization suggestions.
- **Endpoints:**
  - `GET /api/v1/budgets`
  - `POST /api/v1/budgets`
  - `PATCH /api/v1/budgets/:id`
  - `DELETE /api/v1/budgets/:id`
  - `GET /api/v1/ai/budget-optimize`
- **Status:** **`WORKING`**

---

### M. Goals
- **Capabilities:** Milestones, target progress tracking, contribution action, and AI completion forecasting.
- **Endpoints:**
  - `GET /api/v1/goals`
  - `POST /api/v1/goals`
  - `PATCH /api/v1/goals/:id/contribute`
  - `GET /api/v1/ai/goals/:id/forecast`
  - `DELETE /api/v1/goals/:id`
- **Status:** **`WORKING`**

---

### N. Loans & EMI
- **Capabilities:** Principal tracking, monthly EMI calculation, amortization math, and prepayment tenure reduction simulator.
- **Endpoints:**
  - `GET /api/v1/loans`
  - `POST /api/v1/loans`
  - `DELETE /api/v1/loans/:id`
  - `POST /api/v1/loans/calculate-emi`
  - `POST /api/v1/loans/prepayment-simulate`
- **Status:** **`WORKING`**

---

### O. Insurance
- **Capabilities:** Term life, health, motor, and home insurance tracking with annual premium totals and AI coverage review.
- **Endpoints:**
  - `GET /api/v1/insurance`
  - `POST /api/v1/insurance`
  - `DELETE /api/v1/insurance/:id`
  - `GET /api/v1/ai/insurance-review`
- **Status:** **`WORKING`**

---

### P. Subscriptions
- **Capabilities:** Recurring digital service subscriptions, billing cycles, next renewal tracking, and monthly spend rollups.
- **Endpoints:**
  - `GET /api/v1/subscriptions`
  - `POST /api/v1/subscriptions`
  - `DELETE /api/v1/subscriptions/:id`
- **Status:** **`WORKING`**

---

### Q. Calendar
- **Capabilities:** Database-persisted financial events plotting EMIs, SIPs, renewals, and custom bill dates.
- **Endpoints:**
  - `GET /api/v1/calendar/events`
  - `POST /api/v1/calendar/events`
  - `DELETE /api/v1/calendar/events/:id`
- **Status:** **`WORKING`**

---

### R. Notifications
- **Capabilities:** Database-stored alerts for anomalies, budget overages, goal milestones, and system messages.
- **Endpoints:**
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/:id/read`
  - `POST /api/v1/notifications/read-all`
  - `DELETE /api/v1/notifications/:id`
- **Status:** **`WORKING`**

---

### S. OCR Receipt Scanner
- **Capabilities:** Optical extraction of merchant, amount, category, and date from image receipts with preview and required confirmation state before committing.
- **Endpoints:**
  - `POST /api/v1/receipts/scan`
  - `POST /api/v1/receipts/confirm`
- **Status:** **`WORKING`**

---

### T. Export
- **Capabilities:** Authenticated CSV export for transactions, accounts, budgets, goals, investments, loans, insurance, subscriptions, and summary with Bearer header and query token support.
- **Endpoints:**
  - `GET /api/v1/export/transactions.csv`
  - `GET /api/v1/export/accounts.csv`
  - `GET /api/v1/export/budgets.csv`
  - `GET /api/v1/export/goals.csv`
  - `GET /api/v1/export/investments.csv`
  - `GET /api/v1/export/loans.csv`
  - `GET /api/v1/export/insurance.csv`
  - `GET /api/v1/export/subscriptions.csv`
  - `GET /api/v1/export/summary.csv`
- **Status:** **`WORKING`**

---

### U. Real-Time Functionality
- **Capabilities:** Immediate event-driven API re-fetch upon data mutations and TTL-cached market feeds with timestamp tracking.
- **Status:** **`WORKING`**

---

### V. Security
- **Capabilities:**
  - Multi-tenant tenant isolation on all queries (`where: { userId: req.user.id }`).
  - Rate limiting with `express-rate-limit`.
  - HTTP security headers with `helmet`.
  - CORS origin control.
  - Zero sensitive keys leaked to client.
- **Status:** **`WORKING`**

---

### W. Testing
- **Capabilities:** Master comprehensive integration test suite (`node run-all-tests.js`) asserting 20 suites / 66 acceptance test points.
- **Status:** **`WORKING` (66 PASSED | 0 FAILED)**

---

### X. Deployment
- **Configuration:** Clean `.env.example`, npm scripts for start/test/migrate, and full PostgreSQL 17 schema definitions.
- **Status:** **`WORKING`**
