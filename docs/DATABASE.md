# Jinay Finance AI — PostgreSQL Database Specification
**Database Engine:** PostgreSQL 17  
**ORM:** Prisma Client v5.22  
**Database Name:** `finance_jinay`  
**Connection String:** `postgresql://postgres:postgres2905@127.0.0.1:5432/finance_jinay`

---

## 1. Schema Design Principles

1. **Exact Precision for Monetary Values:** All monetary and currency columns use `Decimal(15, 2)` or `Decimal(15, 6)` for fractional asset quantities (e.g. crypto/gold grams). Floating-point inaccuracies are strictly prevented.
2. **Strict Foreign Key Cascading:** Deleting a user safely cascades across profiles, accounts, transactions, budgets, goals, loans, insurance, and tokens.
3. **Compound Indexes for Query Performance:**
   - `transactions`: `@@index([userId])`, `@@index([userId, date])`, `@@index([userId, transactionType])`
   - `budgets`: `@@unique([userId, categoryName, month, year])`
   - `investments`: `@@unique([portfolioId, symbol])`
   - `market_watchlist`: `@@unique([userId, symbol])`
   - `calendar_events`: `@@index([userId, eventDate])`
   - `financial_health_history`: `@@index([userId, createdAt])`

---

## 2. Core Entities & Relationships

```
                                  ┌───────────────────────────┐
                                  │           User            │
                                  │ (id, email, username, ...)│
                                  └─────────────┬─────────────┘
                                                │
         ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
         │ 1:1              │ 1:1               │ 1:N               │ 1:N              │ 1:1
         ▼                  ▼                   ▼                   ▼                  ▼
┌──────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│     Profile      │ │FinancialProfile│ │FinancialAccount│ │  Transaction   │ │   Portfolio    │
└──────────────────┘ └────────────────┘ └───────┬────────┘ └────────────────┘ └───────┬────────┘
                                                │ 1:N                                  │ 1:N
                                                ▼                                      ▼
                                       ┌────────────────┐                     ┌────────────────┐
                                       │  Transaction   │                     │   Investment   │
                                       └────────────────┘                     └────────────────┘
```

---

## 3. Complete Table Inventory (22 Models)

| Table Name | Model | Purpose | Key Constraints |
|---|---|---|---|
| `users` | `User` | Core authentication & user state | `email UNIQUE`, `username UNIQUE`, `googleId UNIQUE` |
| `refresh_tokens` | `RefreshToken` | JWT refresh tokens & session management | `token UNIQUE`, `userId -> users.id (CASCADE)` |
| `profiles` | `Profile` | Extended bio and demographic information | `userId UNIQUE` |
| `financial_profiles` | `FinancialProfile` | Onboarding parameters (income, expenses, risk) | `userId UNIQUE` |
| `financial_plans` | `FinancialPlan` | Computed baseline 50/30/20 financial roadmap | `userId UNIQUE` |
| `financial_accounts` | `FinancialAccount` | Bank accounts, cash wallets, credit cards | `userId -> users.id` |
| `categories` | `Category` | Income & expense category taxonomies | `userId -> users.id (nullable for defaults)` |
| `transactions` | `Transaction` | Financial ledger records (incomes/expenses) | `accountId`, `categoryId`, `date INDEX` |
| `budgets` | `Budget` | Category monthly spending limits | `UNIQUE(userId, categoryName, month, year)` |
| `goals` | `Goal` | Target savings goals & milestone tracker | `userId -> users.id`, `targetDate` |
| `portfolios` | `Portfolio` | Aggregated investment account per user | `userId UNIQUE` |
| `investments` | `Investment` | Asset holdings (Stocks, Gold, Mutual Funds, Crypto)| `UNIQUE(portfolioId, symbol)` |
| `market_watchlist` | `MarketWatchlist` | User's tracked stocks & tickers | `UNIQUE(userId, symbol)` |
| `loans` | `Loan` | Debt obligations, interest rates & EMIs | `userId -> users.id`, `status` |
| `insurance_policies`| `InsurancePolicy`| Life, health, and asset insurance policies | `userId -> users.id`, `renewalDate` |
| `subscriptions` | `Subscription` | Recurring SaaS & utility charges | `userId -> users.id`, `nextBillingDate` |
| `calendar_events` | `CalendarEvent` | Due dates, bills, custom events | `userId -> users.id`, `eventDate INDEX` |
| `notifications` | `Notification` | Real-time in-app alerts and notifications | `userId -> users.id`, `isRead INDEX` |
| `chat_messages` | `ChatMessage` | Conversational history with Gemini AI | `userId -> users.id`, `createdAt` |
| `ai_recommendations`| `AIRecommendation` | Actionable intelligence cards | `userId -> users.id` |
| `financial_health_history` | `FinancialHealthHistory` | Historical 10-factor score tracking | `userId -> users.id`, `createdAt INDEX` |
| `expense_anomalies` | `ExpenseAnomaly` | Outlier expense records detected by rules/ML | `userId -> users.id`, `userFeedback` |

---

## 4. Database Verification Commands

To verify database status and inspect tables via CLI:
```bash
# Check connectivity
node node-backend/test-db.js

# Generate Prisma Client
npx prisma generate

# Inspect tables via Prisma Studio
npx prisma studio
```
