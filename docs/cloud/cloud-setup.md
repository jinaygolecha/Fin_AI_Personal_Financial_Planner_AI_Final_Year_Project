# FinPro — Free-Tier Cloud Setup Handbook

This guide details how to provision free-tier cloud resources for FinPro without recurring charges, utilizing standard cloud provider free allocations.

---

## 1. Cloud PostgreSQL Setup (Options)

### Option A: Neon Serverless PostgreSQL (Recommended - 0.5 GiB Free Tier)
1. Navigate to [https://neon.tech](https://neon.tech) and sign up with GitHub or Google.
2. Click **Create Project** -> Name: `finpro-cloud`.
3. Set PostgreSQL Version: `17` or `16`.
4. Region: Choose the closest region (e.g., `AWS ap-south-1 Mumbai` or `AWS eu-central-1 Frankfurt`).
5. Copy the provided connection string. Neon automatically provides:
   - **Pooled connection string** (recommended for production):
     ```env
     DATABASE_URL="postgresql://finpro_user:PASSWORD@ep-sample-pooler.ap-south-1.aws.neon.tech/finance_jinay?sslmode=require&schema=public"
     ```
6. Add this string to `.env`.

### Option B: Supabase PostgreSQL (500 MB Free Tier)
1. Sign up at [https://supabase.com](https://supabase.com).
2. Create New Project: `finpro-cloud-db`. Set database password.
3. Region: Choose `Central India (Mumbai)` or closest region.
4. Go to **Project Settings** -> **Database** -> **Connection string** -> Choose **URI** (Mode: Transaction or Session).
5. Format:
   ```env
   DATABASE_URL="postgresql://postgres.yourproject:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&schema=public"
   ```

---

## 2. Cloud Object Storage Setup (Options)

### Option A: Cloudflare R2 (10 GB Free Storage, Zero Egress Fees)
1. Sign up at [https://cloudflare.com](https://cloudflare.com) and go to **R2**.
2. Click **Create Bucket** -> Name: `finpro-cloud-documents`.
3. In **R2 Manage API Tokens**, click **Create API Token**:
   - Permissions: `Admin Read & Write`
   - Scope: Specific Bucket -> `finpro-cloud-documents`
4. Note the `Access Key ID`, `Secret Access Key`, and `Endpoint URL`.
5. Configure in `.env`:
   ```env
   STORAGE_PROVIDER=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=finpro-cloud-documents
   S3_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
   S3_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
   S3_FORCE_PATH_STYLE=false
   ```

### Option B: AWS S3 Free Tier (5 GB Free for 12 Months)
1. Sign up at [https://aws.amazon.com](https://aws.amazon.com).
2. Go to **S3** -> Click **Create Bucket** -> Name: `finpro-cloud-documents-<uniqueid>`.
3. Region: `ap-south-1` (Mumbai) or `us-east-1`.
4. In IAM, create a user `finpro-storage-user` with `AmazonS3FullAccess` and generate access keys.
5. Configure in `.env`:
   ```env
   STORAGE_PROVIDER=s3
   S3_ENDPOINT=https://s3.ap-south-1.amazonaws.com
   S3_REGION=ap-south-1
   S3_BUCKET=finpro-cloud-documents-<uniqueid>
   S3_ACCESS_KEY_ID=AKIA...
   S3_SECRET_ACCESS_KEY=...
   S3_FORCE_PATH_STYLE=false
   ```

### Option C: Local Disk Sandbox (Zero Cloud Required)
For offline local development or evaluation without creating cloud storage accounts:
```env
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIR=uploads
```
Files will be stored safely under `uploads/` on the local machine or inside the Docker container.

---

## 3. Initializing Schema in Cloud Database

Once `DATABASE_URL` is placed in `.env`:

```bash
# 1. Compile Prisma Client
npm run db:generate

# 2. Deploy all relational tables safely
npm run db:deploy

# 3. Verify connection and latency
npm run test:cloud
```
The test suite will automatically execute all 14 stages and report verified persistence across accounts, transactions, investments, and storage attachments!
