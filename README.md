# 🎓 Jinay Finance AI — Personal Finance & Investment Advisor

> **Final-Year Engineering Project**  
> **Project Owner / Maintainer**: Jinay Golecha (`jinay_golecha`)  
> **Repository**: [jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)  
> **Technology Stack**: Node.js v22, Express.js 4, Prisma ORM, PostgreSQL 17, Google Gemini AI, Finnhub API, Web Speech API, Vanilla HTML5/CSS3  

---

## 📘 1. Executive Summary & Problem Statement

Managing personal finances, diverse investment asset classes (Equity, Mutual Funds, SIP, Gold, Silver, Crypto), liabilities, insurance policies, and recurring subscriptions across disconnected apps is error-prone.

**Jinay Finance AI** is an AI-powered financial management and investment advisory system tailored specifically for the Indian financial context (**INR - ₹ / Asia/Kolkata**). Built with a PostgreSQL schema, Prisma ORM, and Express REST API backend, the platform provides real-time portfolio valuation, multi-asset allocation insights, automated budget thresholds, loan prepayment simulations, insurance gap analysis, and voice-assisted expense entry.

---

## 🏗️ 2. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    FRONTEND WEB CLIENT                     │
│  HTML5 + Vanilla CSS + Chart.js / ECharts + Web Speech API  │
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

## 🚀 3. Key Feature Modules

1. **Centralized Authentication & Profiles**:
   - Secure registration, password hashing with bcrypt, JWT access & refresh tokens.
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

## 📡 4. REST API Endpoint Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/v1/health` | System health & DB connection | Public |
| `GET` | `/api/v1/health/database` | PostgreSQL latency test | Public |
| `POST` | `/api/v1/auth/register` | Register user & initialize profiles | Public |
| `POST` | `/api/v1/auth/login` | Authenticate & issue JWT | Public |
| `GET` | `/api/v1/auth/me` | Authenticated user profile | Bearer |
| `POST` | `/api/v1/onboarding` | Submit financial onboarding | Bearer |
| `GET` | `/api/v1/dashboard` | Aggregated financial metrics | Bearer |
| `GET` | `/api/v1/accounts` | List financial accounts | Bearer |
| `POST` | `/api/v1/accounts/:id/deposit` | Deposit money atomically | Bearer |
| `GET` | `/api/v1/transactions` | Filterable transaction history | Bearer |
| `POST` | `/api/v1/transactions` | Create income/expense record | Bearer |
| `DELETE`| `/api/v1/transactions/:id` | Delete & reverse balance | Bearer |
| `POST` | `/api/v1/transactions/voice` | Parse voice entry command | Bearer |
| `GET` | `/api/v1/budgets` | Category budget tracking | Bearer |
| `POST` | `/api/v1/goals` | Create savings goal | Bearer |
| `GET` | `/api/v1/investments/portfolio`| Aggregate investment holdings | Bearer |
| `GET` | `/api/v1/market/metals` | Live Gold & Silver rates (INR) | Bearer |
| `POST` | `/api/v1/loans/calculate-emi` | Calculate standard loan EMI | Bearer |
| `POST` | `/api/v1/loans/prepayment-simulate`| Prepayment tenure reduction | Bearer |
| `GET` | `/api/v1/insurance` | Insurance policies & summary | Bearer |
| `GET` | `/api/v1/subscriptions` | Recurring subscriptions | Bearer |
| `POST` | `/api/v1/ai/chat` | Contextual AI financial advice | Bearer |
| `GET` | `/api/v1/ai/investment-analysis` | Asset allocation insights | Bearer |
| `GET` | `/api/v1/ai/insurance-review` | Protection gap analysis | Bearer |
| `GET` | `/api/v1/export/transactions.csv` | Export transactions CSV | Bearer |
| `GET` | `/api/v1/export/summary.csv` | Export summary report CSV | Bearer |

---

## ⚙️ 5. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL 17 (running locally on port 5432)

### 1. Configure Environment Variables
Copy `node-backend/.env.example` to `node-backend/.env`:
```ini
NODE_ENV=development
PORT=5000
DATABASE_URL="postgresql://postgres:postgres2905@127.0.0.1:5432/finance_jinay"
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
GEMINI_API_KEY=your_gemini_api_key
FINNHUB_API_KEY=your_finnhub_api_key
```

### 2. Install Dependencies & Generate Prisma Client
```bash
npm --prefix node-backend install
npm --prefix node-backend run prisma:generate
```

### 3. Run Automated Acceptance Test Suite
```bash
npm test
```

### 4. Start the Application
```bash
npm start
```
Open your browser at `http://127.0.0.1:5000/`.

---

## 👨‍💻 Author & Project Owner

**Jinay Golecha**  
*Final Year Engineering Student*  
GitHub: [@jinaygolecha](https://github.com/jinaygolecha)
