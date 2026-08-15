# 🎓 Jinay Finance AI — Personal Finance & Investment Advisor

> **Final-Year Engineering Project**  
> **Author & Maintainer**: Jinay Golecha (`jinay_golecha`)  
> **Canonical Repository**: [jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)  
> **Technology Stack**: Node.js v22 LTS, Express.js 4, Prisma ORM, PostgreSQL 17, Google Gemini AI, Finnhub API, Web Speech API, Chart.js / ECharts, Vanilla HTML5 / Modern CSS3  
> **License**: MIT  

---

## 📘 1. Executive Summary & Problem Statement

Managing personal cash flows, multi-asset investments (Equities, Mutual Funds, SIP, MCX Gold, Silver, Crypto), liabilities, insurance coverage, and recurring subscriptions across fragmented platforms leads to poor visibility and financial leakages.

**Jinay Finance AI** is a personal finance management and investment advisory platform tailored specifically for the Indian financial ecosystem (**INR - ₹ / Asia/Kolkata**). Built with a PostgreSQL schema, Prisma ORM, and Express REST API server, the system provides real-time portfolio valuation, multi-asset allocation insights, automated budget thresholds, loan prepayment simulations, insurance gap analysis, and voice-assisted expense entry.

---

## 🏗️ 2. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    FRONTEND WEB CLIENT                     │
│  HTML5 + Modern Vanilla CSS + Chart.js + Web Speech API    │
└─────────────────────────────┬──────────────────────────────┘
                              │ HTTP/JSON + JWT Bearer Auth
                              ▼
┌────────────────────────────────────────────────────────────┐
│                EXPRESS REST API SERVER (v1)                │
│    Routes, Controllers, Middleware & Financial Engines    │
├─────────────────────────────┼──────────────────────────────┤
│  • Auth (JWT & Refresh)     │  • Loans & EMI Simulation    │
│  • Financial Onboarding     │  • Insurance & Subscriptions │
│  • Account Atomicity        │  • Precious Metals (MCX)     │
│  • Transactions & Reversals │  • AI Advisor (Gemini/Rules) │
│  • Budgets (50/30/20)       │  • Voice Natural Language    │
│  • Savings Goals            │  • Authenticated CSV Exports │
└─────────────────────────────┬──────────────────────────────┘
                              │ Prisma Queries
                              ▼
┌────────────────────────────────────────────────────────────┐
│               POSTGRESQL DATABASE (finance_jinay)          │
│  Users, Accounts, Transactions, Budgets, Goals, Portfolio  │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 3. Core Feature Modules

1. **Centralized Authentication & Security**:
   - Secure registration, password hashing with `bcrypt` (10 rounds), JWT access (60m) and refresh tokens (7d).
   - Graceful fallback for unconfigured Google OAuth.

2. **Financial Onboarding & 50/30/20 Planning**:
   - 3-step onboarding questionnaire evaluating income, baseline expenses, savings, and debt to generate Financial Health Score (0-100).

3. **Multi-Account Deposit Atomicity**:
   - Add money / deposit flows executed inside database transactions ensuring account balance increments and categorized `INCOME` records stay synchronized.

4. **Expense Management & Balance Reversals**:
   - Tracking categorized expenses.
   - Deleting any transaction automatically triggers an atomic balance reversal (`+₹20,000` upon deleting an expense).

5. **Budgeting Engine (50/30/20 & Custom)**:
   - Monthly category budget limits with live spending correlation and percentage utilized alerts.

6. **Savings Goals & Milestone Tracker**:
   - Target tracking for Emergency Funds, Home, Vehicle, Education, and Retirement with monthly contribution allocation.

7. **Multi-Asset Investment & Precious Metals Hub**:
   - Equities, Mutual Funds, SIP, Crypto, and MCX Gold (24K/22K per gram/10g/oz) and Silver rates.
   - Portfolio valuation with overall P&L.

8. **Loans & Prepayment Simulator**:
   - EMI calculation and prepayment simulator computing interest and tenure savings.

9. **Insurance Policies & Subscriptions**:
   - Tracking Life, Health, Vehicle, and Home insurance policies with renewal alerts.
   - Active subscription tracking (Netflix, Spotify, Cloud) and monthly recurring expense analytics.

10. **Voice Assistant (Natural Language Parser)**:
    - Web Speech API integration with natural language parsing (`"I spent 500 rupees on food"`) and confirmation modal.

11. **Contextual AI Financial Advisor**:
    - Real-time user net worth, cash flow, debt, and portfolio integration with Google Gemini / rule-based advisory engine.

12. **Multi-Format CSV Data Exports**:
    - Authenticated CSV exports for Transactions, Accounts, Budgets, Goals, Investments, Loans, Insurance, Subscriptions, and Comprehensive Summary.

13. **Multi-User Data Isolation**:
    - Strict tenant isolation ensuring User A cannot view, edit, or delete any record belonging to User B.

---

## 🛠️ 4. Technology Stack

| Layer | Technologies |
|---|---|
| **Runtime & Backend** | Node.js v22 LTS, Express.js 4.21 |
| **ORM & Database** | Prisma 5.22, PostgreSQL 17 |
| **Authentication & Security** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `helmet`, `cors`, `express-rate-limit` |
| **Artificial Intelligence** | Google Gemini 1.5 Flash (`@google/generative-ai`) + Rule-Based Advisory Engine |
| **Market Data** | Finnhub Stock API & Spot Precious Metals Engine |
| **Frontend UI** | HTML5, Vanilla CSS3, Remix Icon, Chart.js, ECharts, Web Speech API |
| **Containerization** | Docker, Docker Compose |
| **Testing** | Node test runner, Supertest, 47-assertion acceptance suite |

---

## ⚡ 5. Quick Start Guide

### Prerequisites
- Node.js (v20+ or v22 LTS)
- PostgreSQL 17 (local service or Docker)

---

### Option A: Local Development (Windows / macOS / Linux)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git
   cd Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project
   ```

2. **Configure Environment Variables**:
   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env

   # macOS / Linux
   cp .env.example .env
   ```

3. **Install Dependencies & Generate Prisma Client**:
   ```bash
   npm run setup
   ```

4. **Seed Sample Data (Optional)**:
   ```bash
   npm run db:seed
   ```

5. **Start Application**:
   ```bash
   npm run dev
   ```
   Open `http://127.0.0.1:5000/` in your browser.

---

### Option B: Docker Compose (One-Command Setup)

```bash
git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git
cd Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project

docker compose up --build -d
```
Open `http://127.0.0.1:5000/` in your browser.

---

## 🔑 6. Demo Account Credentials

A pre-populated demo account is available when running `npm run db:seed`:

- **Email**: `demo@example.com`
- **Password**: `DemoPassword123!`

*(You can also register a new account on `/signup.html`)*

---

## ⚙️ 7. Environment Configuration (.env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Runtime environment (`development` / `production`) |
| `PORT` | Yes | `5000` | Port for the Express server |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Cryptographic secret for access tokens |
| `JWT_REFRESH_SECRET`| Yes | — | Cryptographic secret for refresh tokens |
| `FRONTEND_URL` | No | `http://127.0.0.1:5000` | Origin URL for CORS and frontend redirects |
| `GEMINI_API_KEY` | No | — | Google Gemini API key (falls back to rule engine) |
| `FINNHUB_API_KEY` | No | — | Finnhub API key (falls back to delayed reference) |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET`| No | — | Google OAuth 2.0 Client Secret |

---

## 📡 8. REST API Endpoint Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/health` | System health & DB connection status | Public |
| `GET` | `/api/v1/health/database` | PostgreSQL connection test | Public |
| `GET` | `/api/v1/health/ai` | Gemini AI provider health | Public |
| `GET` | `/api/v1/health/market` | Market API provider health | Public |
| `POST` | `/api/v1/auth/register` | Register user & initialize profiles | Public |
| `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT tokens | Public |
| `POST` | `/api/v1/auth/refresh` | Issue new access token via refresh token | Public |
| `GET` | `/api/v1/auth/me` | Return authenticated user details | Bearer |
| `POST` | `/api/v1/onboarding` | Submit financial onboarding profile | Bearer |
| `GET` | `/api/v1/onboarding/status` | Check onboarding completion status | Bearer |
| `GET` | `/api/v1/dashboard` | Aggregated real-time financial metrics | Bearer |
| `GET` | `/api/v1/accounts` | List user financial accounts | Bearer |
| `POST` | `/api/v1/accounts` | Create financial account | Bearer |
| `POST` | `/api/v1/accounts/:id/deposit` | Deposit funds atomically with income entry | Bearer |
| `GET` | `/api/v1/transactions` | Filterable transaction history | Bearer |
| `POST` | `/api/v1/transactions` | Create income/expense with anomaly check | Bearer |
| `DELETE`| `/api/v1/transactions/:id` | Delete transaction & reverse balance | Bearer |
| `POST` | `/api/v1/transactions/voice` | Parse voice entry natural language text | Bearer |
| `GET` | `/api/v1/budgets` | Category budget tracking (50/30/20) | Bearer |
| `POST` | `/api/v1/budgets` | Create / update category budget limit | Bearer |
| `GET` | `/api/v1/goals` | List savings goals & progress | Bearer |
| `POST` | `/api/v1/goals` | Create new savings goal | Bearer |
| `PATCH`| `/api/v1/goals/:id/contribute` | Allocate savings contribution to goal | Bearer |
| `GET` | `/api/v1/investments/portfolio`| Aggregated portfolio valuation & P&L | Bearer |
| `POST` | `/api/v1/investments/buy` | Record equity/fund/crypto/gold holding | Bearer |
| `GET` | `/api/v1/market/metals` | Live Gold (24K/22K) & Silver rates in INR | Bearer |
| `POST` | `/api/v1/loans/calculate-emi` | Standard loan EMI calculator | Bearer |
| `POST` | `/api/v1/loans/prepayment-simulate`| Prepayment interest & tenure simulation | Bearer |
| `GET` | `/api/v1/insurance` | Insurance policies & coverage summary | Bearer |
| `POST` | `/api/v1/insurance` | Create insurance policy | Bearer |
| `GET` | `/api/v1/subscriptions` | Recurring subscriptions & spend analytics | Bearer |
| `POST` | `/api/v1/subscriptions` | Create recurring subscription | Bearer |
| `POST` | `/api/v1/ai/chat` | Contextual AI financial advisor conversation | Bearer |
| `GET` | `/api/v1/ai/investment-analysis`| AI asset allocation & risk diversification | Bearer |
| `GET` | `/api/v1/ai/insurance-review` | AI insurance gap & liability review | Bearer |
| `GET` | `/api/v1/export/transactions.csv` | Export transactions CSV (Bearer or ?token=) | Bearer |
| `GET` | `/api/v1/export/accounts.csv` | Export accounts CSV | Bearer |
| `GET` | `/api/v1/export/budgets.csv` | Export budgets CSV | Bearer |
| `GET` | `/api/v1/export/goals.csv` | Export goals CSV | Bearer |
| `GET` | `/api/v1/export/investments.csv`| Export investments CSV | Bearer |
| `GET` | `/api/v1/export/loans.csv` | Export loans CSV | Bearer |
| `GET` | `/api/v1/export/insurance.csv` | Export insurance CSV | Bearer |
| `GET` | `/api/v1/export/subscriptions.csv`| Export subscriptions CSV | Bearer |
| `GET` | `/api/v1/export/summary.csv` | Export comprehensive financial summary | Bearer |

---

## 🧪 9. Automated Testing

The repository contains an end-to-end integration test suite covering 15 critical test groups:

```bash
npm test
```

### Test Suite Coverage:
- System Diagnostics & PostgreSQL connectivity
- User Registration, duplicate prevention, and Login
- Financial Onboarding & Health Score calculations
- Multi-Account atomic balance updates on deposit
- Real-time Dashboard aggregations from database
- Expense logging, Anomaly detection, and balance reversal upon deletion
- 50/30/20 Category Budget tracking
- Savings Goals and contribution increments
- Multi-Asset Investments & MCX Precious Metals rates in INR
- Loan EMI & Prepayment simulations
- Insurance & Subscription tracking
- Contextual AI Advisor, Investment Analysis, and Insurance Review
- Natural Language Voice Parser
- Authenticated CSV Exports (via Bearer header and query token)
- Strict Multi-Tenant Data Isolation (User A vs User B)

---

## 🚀 10. Deployment Instructions

### Deploy to Render / Railway / Cloud VM

1. **Set Environment Variables**:
   Configure `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `NODE_ENV=production`, `PORT=5000`.
2. **Build Command**:
   ```bash
   npm run setup
   ```
3. **Start Command**:
   ```bash
   npm start
   ```
4. **Health Check Path**:
   `/api/v1/health`

---

## 🔒 11. Security & Hygiene

- **No Secrets in Repository**: All configuration templates use placeholders.
- **Password Protection**: Salted `bcrypt` encryption.
- **Tenant Isolation**: Database queries strictly filter by authenticated `req.user.id`.
- **Export Security**: File downloads require valid JWT authentication.

---

## 👨‍💻 Author & Project Owner

**Jinay Golecha**  
*Final Year Engineering Student*  
GitHub: [@jinaygolecha](https://github.com/jinaygolecha)  
Repository: [Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)
