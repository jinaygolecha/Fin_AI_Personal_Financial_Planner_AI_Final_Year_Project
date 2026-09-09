# FinPro — Personal Finance & Investment Decision Support Platform

[![CI / Build & Test](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-17-blue.svg)](https://www.postgresql.org/)
[![ORM](https://img.shields.io/badge/Prisma-5.22-darkblue.svg)](https://www.prisma.io/)
[![Acceptance Tests](https://img.shields.io/badge/Acceptance%20Tests-96%2F96%20Passed-success.svg)](node-backend/run-all-tests.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **FinPro**  
> **Created by Students of VU**  
> **Project Lead:** Jinay Golecha  
> **Repository:** [jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)  
> **Acceptance Verification Baseline:** 96 Passed | 0 Failed

---

## 1. Problem Statement & Executive Overview

### The Problem
Modern personal finance is fractured across disconnected tools. Users juggle separate applications for day-to-day banking, stock market tracking, bullion valuation, loan amortization, credit card dues, insurance renewals, and financial goal tracking. Existing platforms frequently present synthetic, lagging, or ungrounded recommendations without strict multi-tenant privacy.

### The FinPro Solution
FinPro is an integrated, production-grade personal finance and investment decision support platform engineered specifically for the Indian financial context (INR / ₹ / `en-IN` / `Asia/Kolkata`). 

Key architectural pillars:
- **Unified Full-Stack Architecture:** Node.js 22 LTS / Express 4 backend paired with PostgreSQL 17 via Prisma ORM and a responsive vanilla JavaScript SPA frontend.
- **Audited Market Data Engine:** Real-time stock quotes (NSE/BSE) and COMEX continuous precious metals (24K & 22K Gold, Silver) converted to INR at live interbank FX rates with transparent provider provenance (`LIVE`, `CACHED`, `STALE`, or `UNAVAILABLE`).
- **Grounded AI Financial Intelligence:** Powered by Google Gemini 1.5 Flash grounded strictly in the authenticated user's database records (10-factor financial health score, 30/90-day cash flow projections, what-if simulators, and budget optimization).
- **Comprehensive Obligation Management:** Safe credit/debit card tracking with PCI-aligned sanitization, EMI calculators with loan prepayment simulation, insurance renewal alerts, and financial to-do reminders.
- **Integrated Machine Learning Studio:** Dataset upload, feature distribution analysis, and statistical model training (R², MAE, RMSE metrics) with transparent inference explanations.

---

## 2. System Architecture & Component Design

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND CLIENT (SPA)                    │
│   Vanilla JS (ES6 Modules) + CSS3 Design System             │
│   Served statically by Node.js Express at port 5000         │
└──────────────────────────────▲──────────────────────────────┘
                               │
                       HTTPS / REST / JSON
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  CENTRAL API CLIENT & AUTH                  │
│   frontend/public/assets/js/api.js                          │
│   - Bearer JWT token propagation & refresh logic            │
│   - Unified error handling (401/403/404/422/500)            │
└──────────────────────────────▲──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 NODE.JS / EXPRESS 4 BACKEND                 │
│   node-backend/src/server.js  |  node-backend/src/app.js    │
│   - Middleware: Helmet, CORS, Rate Limiters, Morgan         │
│   - JWT Auth & Google OAuth 2.0 Identity Providers          │
│   - Controllers: Accounts, Tx, Budgets, Goals, AI, Market   │
└──────────────▲──────────────────────────────▲───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼───────────────┐
│        PRISMA ORM 5.22      ││     EXTERNAL SERVICE LAYER   │
│   postgresql://.../finance  ││  - Google Gemini 1.5 Flash   │
│   - 28 Persistent Models    ││  - Live Market Feed Engine   │
│   - Multi-Tenant Isolation  ││  - Marketaux Financial News  │
│   - Atomic Rollback Tx      ││  - Tesseract OCR Engine      │
└─────────────────────────────┘└──────────────────────────────┘
```

---

## 3. Visual Gallery & QA Screenshot Evidence

FinPro includes 30 verified high-resolution browser screenshots in [`docs/screenshots/`](docs/screenshots/). Every screenshot was captured from the actual running application with realistic demo data:

| Feature | Screenshot | Description |
|:---|:---|:---|
| **Command Center** | [`05-dashboard.png`](docs/screenshots/05-dashboard.png) | Unified financial dashboard with net worth, monthly income, expense cards, and health score. |
| **Market Engine** | [`10-market-data.png`](docs/screenshots/10-market-data.png) | Live stock quotes, NSE tickers, volume, and technical indicators (RSI, MACD, BBands). |
| **Precious Metals** | [`11-gold-silver.png`](docs/screenshots/11-gold-silver.png) | Dedicated 24K and 22K Gold and Silver spot rates in INR per 10g/kg with live spreads. |
| **AI Advisor** | [`18-ai-advisor.png`](docs/screenshots/18-ai-advisor.png) | Context-aware AI financial assistant with user snapshot and personalized advice. |
| **What-If Simulator** | [`19-what-if-simulator.png`](docs/screenshots/19-what-if-simulator.png) | Interactive simulation of salary hikes, additional SIPs, and major purchases on net worth. |
| **ML Studio** | [`27-training-studio.png`](docs/screenshots/27-training-studio.png) | Production ML pipeline for financial dataset upload, preprocessing, and training. |

*For the complete verification matrix documenting all 30 screenshots, consult [`docs/screenshots/README.md`](docs/screenshots/README.md).*

---

## 4. Core Features & Capabilities

### 🏦 Accounts & Transactions
- **Multi-Account Support:** Bank savings accounts, trading accounts, cash wallets, and investment holdings.
- **Atomic Balance Synchronization:** Account balances update atomically upon transaction creation, edit, or deletion with automatic reversal on deletion.
- **Automated Anomaly Detection:** Statistical detection flagging expenses deviating significantly from user category norms.

### 📈 Verified Market & Commodity Engine
- **Stocks:** Real-time quote engine supporting NSE/BSE and global equities with historical multi-timeframe charts (1D, 1W, 1M, 1Y).
- **Precious Metals:** Continuous spot rates for 24K/22K Gold and Silver converted to INR via interbank FX with standardized units (`1 troy oz = 31.1035 g`, `1 kg = 1000 g`).
- **Zero Synthetic Curves:** Provider provenance explicitly exposed (`LIVE`, `CACHED`, `STALE`, or `UNAVAILABLE`).

### 💳 Payment Cards & Security
- **Safe Card Tracking:** Nickname, issuer bank, masked last 4 digits (`•••• •••• •••• 4321`), credit limit, and payment due dates.
- **Strict PCI Security:** Explicit rejection of full 16-digit PANs, CVVs, and PINs.
- **Utilization Monitoring:** Real-time credit utilization calculations with color-coded risk alerts.

### 🤖 Grounded AI Financial Advisor & Simulator
- **Gemini 1.5 Flash:** Grounded answers referencing user-specific balances, liabilities, and budgets without cross-tenant data leakage.
- **10-Factor Health Score:** Comprehensive 0–100 score analyzing emergency buffer, savings rate, debt-to-income, and liquidity.
- **Predictive Cash Flow:** 30-day and 90-day balance projections incorporating recurring subscriptions, loan EMIs, and scheduled income.
- **What-If Simulator:** Scenario modeling for salary changes, extra investments, debt prepayments, or major capital expenditures.

### 🧾 OCR Receipt Scanner & Voice Assistant
- **Receipt OCR:** Extracts merchant name, transaction amount, date, and category into a preview confirmation dialog prior to database commit.
- **Voice Assistant:** Natural language intent parser with mandatory confirmation prompts for financial modifications.

### 🔬 Machine Learning Studio
- **Dataset Management:** Upload CSV datasets with column statistics, missing value analysis, and immutable versioning.
- **Model Training & Evaluation:** Computes true mathematical validation metrics ($R^2$, MAE, RMSE) and provides inference explanations.

---

## 5. Technology Stack

| Layer | Technologies |
|:---|:---|
| **Backend** | Node.js 22 LTS, Express 4.21, Helmet, CORS, Express-Rate-Limit, Morgan |
| **Database & ORM** | PostgreSQL 17, Prisma ORM 5.22, Atomic Transactions |
| **Frontend** | Vanilla JavaScript (ES6 Modules), HTML5, CSS3 Custom Design System, ECharts 5.5 |
| **Security & Auth** | JWT (`jsonwebtoken`), `bcryptjs` (10 rounds), Google OAuth 2.0, Multi-Tenant Scoping |
| **AI & ML** | Google Gemini 1.5 Flash, Statistical Linear Regression, Tesseract OCR |
| **Market & News APIs** | Alpha Vantage, Finnhub, Marketaux |
| **Testing & CI/CD** | Custom Acceptance Suite, Jest, GitHub Actions, Docker Compose |

---

## 6. Local Setup & Installation

### Prerequisites
- **Node.js:** `>= 20.0.0` (Node.js 22 LTS recommended)
- **PostgreSQL:** `>= 15.0` (Running locally or via Docker on port 5432)
- **npm:** `>= 10.0.0`

### 1. Clone & Setup Environment
```bash
git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git
cd Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project

# Copy environment configuration
cp .env.example .env
```

### 2. Configure Environment Variables
Edit `.env` with your PostgreSQL database credentials:
```env
DATABASE_URL="postgresql://postgres:your_password@127.0.0.1:5432/finance_jinay"
JWT_SECRET="your_secure_random_jwt_secret_key_minimum_32_characters"
JWT_REFRESH_SECRET="your_secure_random_jwt_refresh_secret_key_minimum_32_characters"
```

### 3. Install Dependencies & Generate Prisma Client
```bash
npm run setup
```

### 4. Seed Development Demo Data (Optional)
```bash
npm run db:seed
```
*Creates safe demo account: `demo@example.com` / `DemoPassword123!` with accounts, budgets, goals, and transactions.*

### 5. Start the Application
```bash
npm run dev
# or
npm start
```
Access the application at **http://127.0.0.1:5000**.

---

## 7. Automated Testing & Code Quality

FinPro maintains a comprehensive acceptance test suite validating 25 distinct financial subsystems:

```bash
# Run full acceptance test suite (96 tests)
npm test

# Run code quality & syntax linter across all JavaScript files
npm run lint

# Run production build validation
npm run build
```

### Acceptance Test Results
```
====================================================================
  FINPRO — MASTER COMPREHENSIVE INTEGRATION & ACCEPTANCE SUITE
====================================================================
  ✅ 96 PASSED | 0 FAILED
  All 25 test phases verified with 100% pass rate.
```

---

## 8. Docker & Production Deployment

### Local Docker Compose
To build and run the entire FinPro stack in isolated containers:
```bash
docker compose up --build
```
This launches:
- `jinay_finance_postgres`: PostgreSQL 17 on port 5432 with healthchecks
- `jinay_finance_app`: Node.js 22 Alpine production container on port 5000

### Production Nginx Reverse Proxy Architecture
```
Internet ──HTTPS──► Nginx Reverse Proxy ──► FinPro Node.js (Port 5000) ──► PostgreSQL 17
```

Sample Nginx block:
```nginx
server {
    listen 443 ssl http2;
    server_name finpro.example.com;

    ssl_certificate /etc/letsencrypt/live/finpro.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/finpro.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 9. CI/CD Pipeline

The repository includes an automated GitHub Actions pipeline (`.github/workflows/ci.yml`):

1. **Checkout:** Clones repository source code.
2. **Runtime Setup:** Sets up Node.js 22 LTS with npm dependency caching.
3. **Dependency Installation:** Clean install of backend dependencies.
4. **Prisma Generation:** Validates schema and generates Prisma Client.
5. **Code Linting:** Static syntax analysis across all 41 JavaScript files (`npm run lint`).
6. **Database Migration:** Executes schema migration on an isolated PostgreSQL service container.
7. **Acceptance Testing:** Runs the 96-test master acceptance suite (`npm test`).
8. **Build Verification:** Executes production build verification (`npm run build`).
9. **Docker Build:** Verifies containerization via `docker build -t finpro:latest .`.

---

## 10. Security & Privacy Highlights

- **Multi-Tenant Isolation:** Every query explicitly enforces `where: { userId: req.user.id }` preventing cross-user data exposure.
- **Cardholder Data Protection:** Strictly rejects full PAN, CVV, and PIN numbers; only accepts masked last-4 digits.
- **Secure Password Hashing:** Bcrypt hashing with 10 salt rounds.
- **Cryptographic JWTs:** 32+ character secrets with short-lived access tokens (60m) and database-tracked refresh tokens.
- **Zero Secret Commits:** Gitignore strictly isolates `.env` files; secrets scanning audited prior to release.

---

## 11. Contributors & Project Attribution

- **Project Title:** FinPro — Personal Finance & Investment Decision Support Platform
- **Academic Context:** Final Year Major Engineering Project (2025–2026)
- **Project Lead:** Jinay Golecha
- **Branding:** FinPro — Created by Students of VU
- **License:** MIT License
