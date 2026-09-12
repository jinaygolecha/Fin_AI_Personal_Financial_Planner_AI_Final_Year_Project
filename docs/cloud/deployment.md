# FinPro — Cloud VM Deployment Handbook

This guide details the complete deployment process for running FinPro on an **Always Free Cloud Virtual Machine** (e.g., Oracle Cloud Infrastructure Always Free Compute VM or Ubuntu 22.04/24.04 LTS).

---

## 1. Prerequisites on Cloud VM

- **OS**: Ubuntu 22.04 or 24.04 LTS
- **RAM**: Minimum 1 GB (Recommended 2 GB+ or swap enabled)
- **Open Ports in Cloud Security List / UFW**:
  - `22` (SSH)
  - `80` (HTTP)
  - `443` (HTTPS)

---

## 2. Server Provisioning & Package Installation

Connect to your cloud VM via SSH and install Docker and Nginx:

```bash
# Update repository lists
sudo apt update && sudo apt upgrade -y

# Install prerequisite tools
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx

# Install Docker Engine & Docker Compose Plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

---

## 3. Clone Repository & Setup Application Directory

```bash
# Clone to /opt/finpro
sudo mkdir -p /opt/finpro
sudo chown -R $USER:$USER /opt/finpro
git clone https://github.com/jinaygolecha/Fin_AI_Personal_Financial_Planner_AI_Final_Year_Project.git /opt/finpro
cd /opt/finpro

# Configure production environment
cp .env.example .env
nano .env
```

**Essential variables to configure in `/opt/finpro/.env`**:
- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL="postgresql://user:pass@your-cloud-db.com:5432/finance_jinay?sslmode=require&schema=public"`
- `JWT_SECRET=generate_a_random_32_char_secret_key`
- `JWT_REFRESH_SECRET=generate_another_random_32_char_secret_key`
- `STORAGE_PROVIDER=local` (or `s3` with S3 credentials)

---

## 4. Deploy Database Migrations

Run database migrations against the cloud database before launching:
```bash
cd /opt/finpro/node-backend
npm install --omit=dev
npx prisma migrate deploy
```

---

## 5. Configure Nginx Reverse Proxy & SSL

Copy the FinPro Nginx configuration:
```bash
sudo cp /opt/finpro/deployment/nginx/finpro.conf /etc/nginx/sites-available/finpro.conf
sudo ln -s /etc/nginx/sites-available/finpro.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Obtain Free Let's Encrypt SSL Certificate (HTTPS)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot will automatically configure HTTPS renewal and reload Nginx.

---

## 6. Configure Systemd Service & Launch Containers

Enable the FinPro systemd service for automatic restart on server reboot:

```bash
sudo cp /opt/finpro/deployment/systemd/finpro.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable finpro.service
sudo systemctl start finpro.service

# Check service status
sudo systemctl status finpro.service
```

---

## 7. Cloud Firewall Hardening (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw enable
```

---

## 8. Ongoing Updates (Zero-Downtime Deployment)

Whenever you push updates to GitHub, run the deployment script:
```bash
chmod +x /opt/finpro/deployment/deploy.sh
/opt/finpro/deployment/deploy.sh
```
This script pulls changes, runs migrations, rebuilds the container, and verifies the readiness probe.
