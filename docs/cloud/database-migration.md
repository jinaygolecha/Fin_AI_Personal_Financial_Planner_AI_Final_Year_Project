# FinPro — Cloud Database Migration & Safety Guide

This document establishes the **safe, non-destructive procedure** for deploying and maintaining FinPro's PostgreSQL relational schema across **Local Development**, **Cloud Staging**, and **Cloud Production** environments.

---

## 1. Safety Principles & Zero Data Loss Policy

1. **Never use `prisma db push` in Production**:
   - `prisma db push` bypasses migration history, risks dropping columns/tables without warning, and cannot be audited.
   - Production deployments must strictly use **`prisma migrate deploy`**, which executes only pending, version-controlled SQL migrations.

2. **Never Delete the Local Database**:
   - Keep your local PostgreSQL instance as a secure development sandbox.
   - Cloud migration is performed by applying migrations or streaming schema + data copies, never by wiping local state.

3. **Explicit Connection Control**:
   - Environment connection is controlled entirely by `DATABASE_URL`.
   - Never hardcode hostnames, ports, usernames, or passwords in application code.

---

## 2. Step-by-Step Cloud PostgreSQL Migration Process

### Step 1: Provision Cloud PostgreSQL
Choose a cloud-managed PostgreSQL provider (minimum PostgreSQL 15+, recommended PostgreSQL 16 or 17):
- **Neon Serverless PostgreSQL** (AWS / GCP / Azure free tier)
- **Supabase Managed PostgreSQL** (AWS free tier)
- **Oracle Cloud Infrastructure (OCI) PostgreSQL** (Always Free VM / Database)
- **AWS RDS PostgreSQL** (Free Tier t3.micro / t4g.micro)
- **Aiven for PostgreSQL** (Free tier)

Ensure SSL is enabled (`sslmode=require`).

### Step 2: Configure `DATABASE_URL`
Set the `DATABASE_URL` in your `.env` file or cloud secrets manager:

```env
# Cloud Managed PostgreSQL with SSL
DATABASE_URL="postgresql://finpro_user:YOUR_STRONG_PASSWORD@ep-sample-pooler.eu-central-1.aws.neon.tech/finance_jinay?sslmode=require&schema=public"

# If using a Connection Pooler (PgBouncer or Supabase Transaction Pooler):
DATABASE_URL="postgresql://finpro_user:YOUR_STRONG_PASSWORD@ep-sample-pooler.eu-central-1.aws.neon.tech:6543/finance_jinay?pgbouncer=true&sslmode=require&schema=public"
```

### Step 3: Generate Prisma Client
Compile the Prisma query engine against your active schema:
```bash
npm run db:generate
# Or from node-backend:
npx prisma generate
```

### Step 4: Run Prisma Migrations
Apply all migration files from `node-backend/prisma/migrations/` to the cloud database:
```bash
# In node-backend directory:
npx prisma migrate deploy
```
*Output confirmation:*
```
1 migration found in prisma/migrations
Applying migration `20260811173909_init_finance_jinay`
The following migration has been applied:
  - 20260811173909_init_finance_jinay
All migrations have been successfully applied.
```

### Step 5: Verify Tables in Cloud Database
Verify that all 25+ relational tables exist in the target cloud database:
```bash
npx prisma studio
# Or via psql:
# \dt
```
Core tables verified:
- `users`, `profiles`, `financial_profiles`
- `financial_accounts`, `transactions`, `categories`
- `budgets`, `goals`, `investments`, `portfolios`
- `loans`, `insurance_policies`, `subscriptions`
- `receipt_scans`, `export_jobs`, `audit_logs`

### Step 6: Create Seed / Demo Data (Optional for Staging)
To populate baseline categories, demo accounts, and reference indices:
```bash
npm run db:seed
```

### Step 7: Start the Application
```bash
npm start
# Or for local development:
npm run dev
```

### Step 8–11: Verification Checklist
Execute the verified cloud persistence cycle:
1. **Signup**: Register a test user via `POST /api/v1/auth/register`.
2. **Login**: Authenticate via `POST /api/v1/auth/login` and obtain JWT access token.
3. **Transaction**: Create an income/expense record via `POST /api/v1/transactions`.
4. **Persistence Test**: Log out, log in again, and confirm the transaction and updated balance persist in the cloud database.
5. **Health Check**: Open `http://localhost:5000/status.html` or inspect `GET /api/v1/health/database` to verify latency and connectivity.

---

## 3. Data Backup and Restore Procedure

### Exporting Local Database Data
```bash
# Dump local database to a secure SQL file
pg_dump -U postgres -h 127.0.0.1 -p 5432 -d finance_jinay -F c -b -v -f finpro_backup.dump
```

### Importing Data to Cloud PostgreSQL
```bash
# Restore directly into cloud PostgreSQL instance
pg_restore -U finpro_user -h <CLOUD_HOST> -p 5432 -d finance_jinay -v finpro_backup.dump
```

---

## 4. Troubleshooting Cloud Connections

| Error | Root Cause | Resolution |
|---|---|---|
| `Can't reach database server at ...` | Network/Firewall blocked or wrong port | Verify cloud security group allows inbound traffic on port 5432 or 6543 |
| `SSL connection is required` | Connection string lacks SSL flags | Append `?sslmode=require` to `DATABASE_URL` |
| `Connection pool exhausted` | Too many concurrent serverless connections | Append `?connection_limit=10` or use PgBouncer pooler URL (`?pgbouncer=true`) |
| `P3005: Database schema is not empty` | Migration history table missing | Run `npx prisma migrate resolve --applied <migration_name>` to synchronize history |
