# 🎓 Jinay Finance AI — Personal Finance & Investment Advisor

> **Final-Year Engineering Project**  
> **Author & Maintainer**: Jinay Golecha (`jinay_golecha`)  
> **Canonical Repository**: [jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)  
> **Technology Stack**: Node.js v20+ LTS, Express.js 4, Prisma ORM 5.22, PostgreSQL 17, Google Gemini AI, Alpha Vantage API, Finnhub API, Web Speech API, ECharts, Vanilla HTML5 / Modern CSS3  
> **License**: MIT  

---

## 📘 1. Executive Summary & Problem Statement

Managing personal cash flows, multi-asset investments (Equities, Mutual Funds, SIP, MCX Gold, Silver, Crypto), liabilities, insurance coverage, and recurring subscriptions across fragmented platforms leads to poor visibility and financial leakages.

**Jinay Finance AI** is a comprehensive personal finance management and investment advisory platform tailored specifically for the Indian financial ecosystem (**INR - ₹ / Asia/Kolkata**). Built with a PostgreSQL schema, Prisma ORM, and Express REST API server, the system provides real-time portfolio valuation, multi-asset allocation insights, automated budget thresholds, loan prepayment simulations, insurance gap analysis, voice-assisted expense entry, OCR receipt extraction, and live market intelligence.

---

## 🏗️ 2. System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    FRONTEND WEB CLIENT                     │
│   HTML5 + Modern Vanilla CSS + ECharts + Web Speech API    │
└─────────────────────────────┬──────────────────────────────┘
                              │ HTTP/JSON + JWT Bearer Auth
                              ▼
┌────────────────────────────────────────────────────────────┐
│                EXPRESS REST API SERVER (v1)                │
│    Routes, Controllers, Middleware & Financial Engines     │
├─────────────────────────────┼──────────────────────────────┤
│  • Auth (JWT & Refresh)     │  • Loans & EMI Simulation    │
│  • Financial Onboarding     │  • Insurance & Subscriptions │
│  • Account Atomicity        │  • Alpha Vantage Market Data │
│  • Transactions & Reversals │  • 24K/22K Gold & Silver     │
│  • Budgets (50/30/20)       │  • AI Advisor (Gemini/Rules) │
│  • Savings Goals            │  • Voice Natural Language    │
│  • Portfolio Valuation      │  • Authenticated CSV Exports │
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
   - Multi-tenant data isolation preventing cross-user data leakage.

2. **Live Market Dashboard (`market.html`)**:
   - Real-time stock quotes powered by **Alpha Vantage** with Finnhub fallback.
   - 24K & 22K Gold and Silver spot prices in INR per gram, 10g, and troy ounce.
   - Interactive 7-timeframe chart (1D intraday to 5Y) using Apache ECharts.
   - Technical Indicators: RSI(14), MACD, SMA 20/50, and Bollinger Bands.
   - Live USD/INR FX conversion and WTI Crude Oil in INR.
   - Global commodities strip (Brent, Natural Gas, Copper, Wheat, Coffee).

3. **Financial Onboarding & 50/30/20 Planning**:
   - 3-step onboarding questionnaire evaluating income, baseline expenses, savings, and debt to generate Financial Health Score (0-100).

4. **Multi-Account Deposit Atomicity**:
   - Add money / deposit flows executed inside database transactions ensuring account balance increments and categorized `INCOME` records stay synchronized.

5. **Transactions Ledger & Dynamic Balance Sync**:
   - Record income/expense transactions with automatic account balance updates.
   - Deleting a transaction automatically reverses its balance impact.

6. **Category Budgeting & AI Optimizer**:
   - 50/30/20 budget framework with real-time spending progress bars.
   - AI Budget Optimizer calculating suggested budget amounts based on historical habits.

7. **Financial Goals & Milestone Forecaster**:
   - Track targets for Emergency Fund, Home Down Payment, Car, Education, Retirement.
   - Forecasting engine projecting completion dates and acceleration scenarios.

8. **Multi-Asset Investments & P&L**:
   - Track Stocks, 24K/22K Gold, Silver, Mutual Funds, SIPs, and Crypto.
   - Real-time valuation and profit/loss computation.

9. **Loans, Reducing-Balance EMI & Prepayment Simulator**:
   - Track debt obligations, calculate monthly EMIs, and simulate interest savings on prepayment.

10. **Insurance & Subscription Manager**:
    - Policy coverage tracking, renewal alerts, and recurring subscription cost monitoring.

11. **AI Financial Advisor & Gemini Chat**:
    - Google Gemini AI advisory engine grounded in real user database figures.
    - Deterministic rule-based expert system fallback.
    - Conversational history persisted to database.

12. **Voice Assistant & Intent Recognition**:
    - Web Speech API integration with natural language intent classification.
    - Safety confirmation gate before committing expense creations.

13. **OCR Receipt Scanner & Statement CSV Importer**:
    - Parse receipts and bank statements with user confirmation modal before persistence.

14. **Authenticated CSV Data Exports**:
    - Download verified CSV reports across 9 financial categories with JWT authorization.

---

## 🛠️ 4. Quick Start & Installation

### Prerequisites
- Node.js v20+ LTS
- PostgreSQL 17
- npm v10+

### Setup Commands
```bash
# 1. Clone repository
git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git
cd Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project

# 2. Configure environment
cp .env.example .env
cp node-backend/.env.example node-backend/.env

# 3. Install backend dependencies & initialize Prisma
cd node-backend
npm install
npx prisma generate
npx prisma db push

# 4. Start the application
npm start
```
Access the application at `http://127.0.0.1:5000/`.

---

## 🧪 5. Testing & Quality Assurance

Run the comprehensive test suites:
```bash
# Master 66-point integration suite
node run-all-tests.js

# 40-point security & auth audit suite
node test-auth-comprehensive.js

# Live external market API suite
node test-market-live.js
```

---

## 📚 6. Documentation Index

Detailed architectural and QA documents are located in the `docs/` folder:
- [System Architecture](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/ARCHITECTURE.md) (`docs/ARCHITECTURE.md`)
- [REST API Specification](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/API.md) (`docs/API.md`)
- [PostgreSQL Database Design](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/DATABASE.md) (`docs/DATABASE.md`)
- [Automated Testing & QA Guide](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/TESTING.md) (`docs/TESTING.md`)
- [Deployment & Setup Guide](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/DEPLOYMENT.md) (`docs/DEPLOYMENT.md`)
- [Known Limitations & API Quotas](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/KNOWN_LIMITATIONS.md) (`docs/KNOWN_LIMITATIONS.md`)
- [Master QA & Production Hardening Report](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/FINAL_QA_REPORT.md) (`docs/FINAL_QA_REPORT.md`)
- [Project Audit Matrix](file:///e:/FINAL_YEAR_PROJECT/Minor%20Project/Final-Year-Project/docs/PROJECT_AUDIT.md) (`docs/PROJECT_AUDIT.md`)

---

## 👨‍💻 Author

**Jinay Golecha**  
*Final-Year Engineering Project — AI-Powered Personal Finance & Investment Advisor*
