# FinPro — Live Cloud Deployment & Verification Handbook

This document provides the exact end-to-end procedure for deploying FinPro to a **live cloud environment** using free-tier cloud resources (Supabase Managed PostgreSQL + Supabase/S3 Storage + Oracle Cloud Infrastructure Always Free VM).

---

## 1. Target Live Cloud Architecture

```
User (Browser / HTTPS)
       │
     Port 443
       │
[ Nginx Reverse Proxy ] (Let's Encrypt SSL)
       │
     Port 5000
       │
[ FinPro Docker Container ] (Node.js 22 LTS, Non-Root)
       ├─── TLS Port 6543 / 5432 ───> [ Supabase Managed Cloud PostgreSQL ]
       └─── HTTPS S3 REST API   ───> [ Cloud Object Storage ]
```

---

## 2. Cloud Service Provisioning Steps

### A. Provision Supabase Managed PostgreSQL
1. Register at [https://supabase.com](https://supabase.com).
2. Create project `finpro-cloud`. Choose the closest AWS region (e.g. `ap-south-1` Mumbai).
3. Under **Project Settings -> Database -> Connection String**, copy the **Transaction Pooler URL** (port `6543`) with `?pgbouncer=true&sslmode=require`.
4. Enter this in your local or server `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&schema=public"
   ```

### B. Provision Cloud Object Storage
1. In Supabase, navigate to **Storage -> Create Bucket** -> Name: `finpro-cloud-documents` (Public or Private).
2. Under **Project Settings -> Storage**, note your S3 access credentials:
   - S3 Endpoint: `https://[project-ref].supabase.co/storage/v1/s3`
   - Region: `auto` (or project region)
   - S3 Access Key ID: `[access_key_id]`
   - S3 Secret Access Key: `[secret_access_key]`
3. Enter these in `.env`:
   ```env
   STORAGE_PROVIDER=s3
   S3_ENDPOINT=https://[project-ref].supabase.co/storage/v1/s3
   S3_REGION=auto
   S3_BUCKET=finpro-cloud-documents
   S3_ACCESS_KEY_ID=[your_access_key_id]
   S3_SECRET_ACCESS_KEY=[your_secret_access_key]
   S3_FORCE_PATH_STYLE=true
   ```

### C. Deploy Database Schema
Deploy Prisma migrations to the cloud database:
```bash
npx prisma migrate deploy
```
*Verification*: All 28 models are compiled and migrated into the live Supabase schema without data loss.

---

## 3. Cloud Virtual Machine (Oracle Cloud Always Free) Setup

1. In Oracle Cloud Console, launch an **Ampere A1 Compute Instance** or **AMD E2.1.Micro** with Ubuntu 24.04 LTS.
2. In Virtual Cloud Network (VCN) Ingress Rules, allow:
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 22 (SSH)
3. SSH into the server:
   ```bash
   ssh -i ~/.ssh/id_rsa ubuntu@<VM_PUBLIC_IP>
   ```
4. Install Docker and Nginx:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
   sudo usermod -aG docker $USER
   ```
5. Clone and configure:
   ```bash
   sudo git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git /opt/finpro
   sudo chown -R $USER:$USER /opt/finpro
   cd /opt/finpro
   cp .env.example .env
   # Configure DATABASE_URL and STORAGE variables
   ```
6. Run deployment:
   ```bash
   chmod +x deployment/deploy.sh
   ./deployment/deploy.sh
   ```
7. Configure SSL (HTTPS) via Certbot:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 4. Live Verification Checklist

Once deployed, verify:
- [x] **Raw /health probe**: `curl https://yourdomain.com/api/v1/health`
- [x] **Database probe**: `curl https://yourdomain.com/api/v1/health/database` (confirm latency < 100ms, masked host, SSL enabled)
- [x] **Storage probe**: `curl https://yourdomain.com/api/v1/health/storage` (confirm provider `s3`, status `available`)
- [x] **Readiness probe**: `curl https://yourdomain.com/api/v1/health/ready` (confirm HTTP 200 `ready: true`)
- [x] **Web Status Dashboard**: Open `https://yourdomain.com/status.html` in your browser.
- [x] **Data Persistence Verification**: Run `npm run test:cloud` to test the full 12-module persistence cycle.
