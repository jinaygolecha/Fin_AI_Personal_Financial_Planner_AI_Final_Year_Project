# FinPro — Personal Finance & Investment Decision Support Platform

[![CI / Build & Test](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project/actions/workflows/ci.yml/badge.svg)](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-17-blue.svg)](https://www.postgresql.org/)
[![ORM](https://img.shields.io/badge/Prisma-5.22-darkblue.svg)](https://www.prisma.io/)
[![Acceptance Tests](https://img.shields.io/badge/Acceptance%20Tests-96%2F96%20Passed-success.svg)](node-backend/run-all-tests.js)
[![Cloud Persistence](https://img.shields.io/badge/Cloud%20Persistence-29%2F29%20Passed-success.svg)](node-backend/test-cloud-verification.js)
[![Cloud Resiliency](https://img.shields.io/badge/Cloud%20Resiliency-17%2F17%20Passed-success.svg)](node-backend/test-cloud-failure.js)
[![Major Repair Suite](https://img.shields.io/badge/Engineering%20Repair-33%2F33%20Passed-success.svg)](node-backend/test-major-engineering-repair.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **FinPro**  
> **Created by Students of VU**  
> **Project Lead:** Jinay Golecha  
> **Repository:** [jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project](https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project)  
> **Verification Baseline:** 175 Passed | 0 Failed Across 4 Specialized Automated Test Suites

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

## Cloud Computing Architecture

FinPro implements a decoupled, production-grade cloud computing architecture designed for high availability, fault isolation, and persistent data integrity across distributed environments.

```
                INTERNET (HTTPS :443)
                         |
                 [ Nginx Reverse Proxy ]
                 - SSL Termination (Let's Encrypt)
                 - Gzip Compression & Rate Limiting
                         |
                  Proxy (:5000)
                         |
           +-----------------------------+
           |  FINPRO DOCKER CONTAINER    |
           |  Node.js 22 LTS (Non-Root)  |
           |  Express + SPA Frontend     |
           +-----------------------------+
                   /              \
 DATABASE_URL     /                \   S3 REST API / Local
 (Encrypted TLS) /                  \
                v                    v
    +----------------------+  +-------------------------+
    |   CLOUD POSTGRESQL   |  |   CLOUD OBJECT STORAGE  |
    |   (Managed RDS/Neon/ |  |   (S3 / R2 / OCI /      |
    |    Supabase / OCI)   |  |    Local Disk Fallback) |
    |   Persistent DB      |  |   Receipts & Reports    |
    |   Automated Backups  |  |   Signed URLs & Quotas  |
    +----------------------+  +-------------------------+
```

### 1. Cloud Database
- **Engine:** Managed PostgreSQL (compatible with Neon Serverless, Supabase, AWS RDS, GCP Cloud SQL, or Oracle Cloud PostgreSQL).
- **Driver & ORM:** Prisma ORM with connection pooling support (`pgbouncer=true`).
- **Connection Model:** Database connectivity is controlled strictly via `DATABASE_URL` with SSL enforcement (`sslmode=require`), ensuring credentials are never hardcoded.
- **Zero-Data-Loss Migrations:** Schema changes are applied via version-controlled SQL migrations using `npx prisma migrate deploy` rather than destructive schema pushes.
- **Complete Documentation:** Step-by-step setup and migration guides in [`docs/cloud/database-migration.md`](docs/cloud/database-migration.md).

### 2. Cloud Object Storage
- **Unified Abstraction:** `storageService` provides a clean interface for `upload`, `download`, `delete`, `getPublicOrSignedUrl`, and `checkStorageHealth`.
- **Dual-Provider Architecture:**
  - **Development Mode:** Local disk storage (`uploads/`) for zero-cost offline development.
  - **Production Mode:** S3-compatible cloud object store (AWS S3, Cloudflare R2, Oracle Cloud Object Storage, MinIO, or Backblaze B2) utilizing native AWS Signature Version 4.
- **Integrated Features:** OCR receipt image persistence, generated monthly financial PDF/CSV reports, and user document proofs.

### 3. Cloud Compute
- **Hosting Target:** Optimized for deployment on an Always Free Cloud VM (Oracle Cloud Infrastructure Ampere A1 / AMD VM or Ubuntu 22.04/24.04 LTS).
- **Reverse Proxy:** Production Nginx configuration handling SSL/TLS termination, HTTP/2 multiplexing, security headers, rate limiting (20 r/s), and WebSocket forwarding.
- **Service Management:** Managed via a systemd unit (`finpro.service`) with automated container recovery across server reboots. Deployment guides available in [`docs/cloud/deployment.md`](docs/cloud/deployment.md).

### 4. Docker Containerization
- **Multi-Stage Build:** Builder stage compiles Prisma Client and resolves production dependencies; minimal Runner stage runs on lightweight Node.js 22 LTS Alpine.
- **Security Hardening:** Enforces non-root container user (`USER node`) execution with isolated `/app/uploads` volume ownership.
- **Container Healthcheck:** Built-in `HEALTHCHECK` directive probing `/api/v1/health/ready` every 30 seconds.
- **Docker Compose:** Supports both local standalone development (`postgres` container + `app` container) and cloud production (`app` container connecting directly to external Cloud PostgreSQL).

### 5. CI/CD (Continuous Integration & Delivery)
- **Automated GitHub Actions Pipeline:** Executes on every push and pull request to `main` and `develop`.
- **Honest, Fail-Fast Quality Gates:**
  1. Dependency resolution with npm caching.
  2. Prisma ORM generation.
  3. Code quality and syntax linting (`npm run lint`).
  4. Migration deployment verification against test database (`prisma migrate deploy`).
  5. Master Acceptance Test Suite (`npm test`).
  6. Cloud Data Persistence Verification Suite (`npm run test:cloud`).
  7. Production build verification (`npm run build`).
  8. Multi-stage Docker container build (`docker build -t finpro:latest .`).

### 6. Health Monitoring & Observability
- **Real Probes (Zero Mocking):**
  - `GET /api/v1/health`: Overall health, environment tier, and version.
  - `GET /api/v1/health/database`: Live `SELECT 1` execution, round-trip latency (ms), masked cloud host, and SSL state.
  - `GET /api/v1/health/storage`: Live read/write verification of storage provider and latency (ms).
  - `GET /api/v1/health/ready`: Orchestrator readiness probe returning HTTP 200 when ready or HTTP 503 when dependencies are unreachable.
- **Interactive Cloud Status Page:** Web dashboard at `/status.html` rendering live subsystem telemetry with auto-refresh every 30 seconds. Detailed metrics documentation in [`docs/cloud/monitoring.md`](docs/cloud/monitoring.md).

### 7. Backup & Disaster Recovery
- **Database Snapshots:** Managed cloud database automated point-in-time recovery (PITR) combined with scheduled logical dumps via `pg_dump`.
- **Storage Durability:** Cloud object storage lifecycle policies with versioning and immutable backups.
- **Documented Runbooks:** Step-by-step backup, restore, and disaster recovery procedures detailed in [`docs/cloud/database-migration.md`](docs/cloud/database-migration.md).

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

### 📄 Unified Document Ingestion & Bank Statement Analyzer (PDF / CSV / Scanned OCR)
- **Multi-Format Processing:** Ingests native text PDFs, scanned image PDFs, and CSV statements through a unified pipeline (`DocumentIngestionService`).
- **Dual-Engine PDF Extraction:** Employs `pdf-parse` for instantaneous digital text extraction and falls back automatically to `tesseract.js` worker OCR for scanned documents.
- **Compound Duplicate Detection:** Eliminates false duplicates by evaluating a multi-attribute compound identity (`userId + accountId + normalized date + normalized description + rounded amount + type`).
- **Interactive Review Table:** Displays extracted rows with confidence scores, duplicate status, and editable fields. Users can review, approve, reject, select all, and bulk import to Cloud PostgreSQL.
- **Active Learning Loop:** Category corrections made during review are saved to `ml_feedback.json` for continuous model retraining.

### 🧠 Supervised Machine Learning Transaction Categorization
- **ML Architecture:** Scikit-learn TF-IDF n-gram vectorizer (1-2 word grams) paired with Multinomial Logistic Regression (`LogisticRegression(C=1.5, max_iter=400)`).
- **16 Financial Categories:** Predicts Food & Dining, Groceries, Transport, Utilities, Healthcare, Shopping, Entertainment, Rent, EMI/Loan, Insurance, Investment, Salary/Income, Bills, Subscriptions, Education, and Other.
- **Calibrated Confidence Scoring:** Returns softmax probability distributions; transactions scoring below 50% confidence are automatically flagged as `Needs Review` to prevent misclassification.
- **In-Process V8 Inference:** Model weights exported to `model_artifacts.json` allowing high-throughput, low-latency vectorized inference without Python process-spawn bottlenecks.

### 🧾 OCR Receipt Scanner with GST Tax Breakdown
- **Cloud Receipt Processing:** Uploads receipt images to cloud object storage with user-scoped isolation (`users/<userId>/receipts/`).
- **Automated Field Extraction:** Extracts merchant name, date, total amount, payment method, and tax details using Tesseract OCR.
- **GST Deep Extraction:** Detects 15-character GSTINs, validates checksum/state format, and isolates taxable amount, CGST, SGST, IGST, and total GST.
- **Pre-Commit Verification:** Users inspect and adjust OCR results in a dedicated review modal before committing to database.

### 💳 FinPro Credit Health Indicator & CIBIL Architecture
- **Layer 1 — Credit Health Indicator:** Computes an algorithmic credit score on a standard 300–900 scale based on 5 weighted financial factors:
  - Payment consistency and on-time transaction behavior
  - EMI and debt burden relative to income (DTI ratio)
  - Savings cushion and emergency liquidity buffer
  - Credit utilization across payment cards
  - Active debt account diversity
- **Transparent Bureau Disclaimer:** Clearly identifies as an internal estimation with explicit notification: *"FinPro Credit Health Indicator — Not an official CIBIL score. Official CIBIL score integration requires an authorized credit-bureau service."*
- **Layer 2 — Official Bureau Status:** Transparently displays bureau integration provider status (`NOT_CONFIGURED` without mock scores).
- **Layer 3 — Educational Intelligence:** Provides actionable recommendations to build and maintain high creditworthiness.

### 🏛️ GST Information & Real-Time Tax Calculator
- **GSTIN Validation:** Validates Indian 15-character alphanumeric Goods & Services Tax Identification Numbers with state jurisdiction mapping.
- **Provider Status:** Reports live integration status honestly (`NOT_CONFIGURED` unless authorized government/GSP API keys are present; zero web scraping).
- **Real-Time Tax Calculator:** Interactive breakdown calculator for intra-state (CGST + SGST) and inter-state (IGST) transactions across standard Indian tax slabs (5%, 12%, 18%, 28%).

### 📈 Verified Market & Commodity Engine

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

FinPro maintains a rigorous, multi-tiered test suite validating all financial subsystems, cloud persistence, fault tolerance, and document ingestion:

```bash
# 1. Master Acceptance Test Suite (96 tests validating all 25 core subsystems)
npm test

# 2. Cloud Persistence & Storage Verification Suite (29 tests)
npm run test:cloud

# 3. Cloud Failure Injection & Resiliency Suite (17 tests)
npm run test:cloud:failure

# 4. Major Engineering Repair & Intelligence Suite (33 tests: PDF, CSV, ML, OCR, Credit, GST)
npm run test:repair

# 5. Code quality & syntax linter across all JavaScript files
npm run lint

# 6. Production build validation
npm run build
```

### Comprehensive Test Suite Results
```
====================================================================
  FINPRO — AUTOMATED VERIFICATION RESULTS (175 / 175 PASSED)
====================================================================
  ✅ Master Acceptance Suite:            96 PASSED | 0 FAILED
  ✅ Cloud Persistence Suite:            29 PASSED | 0 FAILED
  ✅ Cloud Resiliency & Failure Suite:   17 PASSED | 0 FAILED
  ✅ Major Engineering Repair Suite:     33 PASSED | 0 FAILED
  ------------------------------------------------------------------
  TOTAL:                                175 PASSED | 0 FAILED (100%)
====================================================================
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
