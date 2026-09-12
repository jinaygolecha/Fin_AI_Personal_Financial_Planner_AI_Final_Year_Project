# FinPro — Cloud Monitoring & Health Telemetry

FinPro implements a multi-tier, real-time health inspection and diagnostic architecture designed for cloud orchestrators (Docker, Kubernetes, AWS ECS) and human observers (administrators, college examiners).

---

## 1. Health & Diagnostic Endpoints

All health probes return real measured metrics without mocked numbers or synthetic delays.

### A. Primary Health Probe (`GET /api/v1/health`)
- **Status Code**: `200 OK` (Healthy) or `503 Service Unavailable` (Degraded)
- **Purpose**: General liveliness check used by load balancers and uptime monitors.
- **Example Response**:
```json
{
  "success": true,
  "status": "healthy",
  "application": "online",
  "environment": "production",
  "database": "connected",
  "databaseLatencyMs": 14,
  "databaseTier": "cloud",
  "storage": "available",
  "storageProvider": "s3",
  "storageLatencyMs": 32,
  "timestamp": "2026-09-12T13:00:00.000Z",
  "version": "1.0.0",
  "project": "FinPro — Personal Finance & Investment Decision Support Platform",
  "owner": "Jinay Golecha"
}
```

---

### B. Persistent Database Probe (`GET /api/v1/health/database`)
- **Status Code**: `200 OK` (Connected) or `503 Service Unavailable` (Disconnected)
- **Operation**: Executes `SELECT 1` through Prisma query engine and measures round-trip time.
- **Example Response**:
```json
{
  "success": true,
  "status": "connected",
  "healthy": true,
  "latencyMs": 12,
  "configured": true,
  "provider": "PostgreSQL",
  "isCloud": true,
  "environmentType": "cloud",
  "host": "ep-sam***.ap-south-1.aws.neon.tech",
  "port": "5432",
  "database": "finance_jinay",
  "ssl": true,
  "connectionPooler": true,
  "timestamp": "2026-09-12T13:00:00.000Z"
}
```

---

### C. Cloud Object Storage Probe (`GET /api/v1/health/storage`)
- **Status Code**: `200 OK` (Available) or `503 Service Unavailable` (Degraded/Error)
- **Operation**: Checks active storage provider (local disk write/read or S3 bucket ping).
- **Example Response**:
```json
{
  "success": true,
  "available": true,
  "status": "available",
  "provider": "s3",
  "bucket": "finpro-cloud-documents",
  "region": "ap-south-1",
  "latencyMs": 45,
  "timestamp": "2026-09-12T13:00:00.000Z"
}
```

---

### D. Cloud Orchestrator Readiness Probe (`GET /api/v1/health/ready`)
- **Status Code**: `200 OK` (Ready to accept client traffic) or `503 Service Unavailable` (Dependency Down)
- **Purpose**: Kubernetes/Docker `HEALTHCHECK` probe. Fails if either Database or Storage is unreachable.
- **Example Response**:
```json
{
  "ready": true,
  "status": "ready",
  "timestamp": "2026-09-12T13:00:00.000Z",
  "environment": "production",
  "checks": {
    "database": {
      "healthy": true,
      "status": "connected",
      "latencyMs": 14,
      "tier": "cloud",
      "host": "ep-sam***.ap-south-1.aws.neon.tech"
    },
    "storage": {
      "available": true,
      "status": "available",
      "provider": "s3",
      "latencyMs": 35
    }
  }
}
```

---

## 2. Interactive Cloud Status Dashboard (`/status.html`)

The web frontend includes a live status dashboard at `/status.html`:
- **Real-Time Polls**: Queries all four diagnostic endpoints concurrently.
- **Visual Subsystem Cards**: Instant feedback on Application, PostgreSQL, Object Storage, and Readiness.
- **Auto-Refresh**: Live 30-second countdown with manual "Check Now" button.
- **Direct JSON Links**: Provides one-click verification of raw HTTP payload responses for academic examiners.

---

## 3. Container & Host Logging

FinPro uses structured logging with morgan and JSON formatting:
```bash
# View live container logs
docker logs -f finpro_production_app

# View systemd service status
sudo systemctl status finpro.service

# View Nginx reverse proxy access logs
sudo tail -f /var/log/nginx/access.log
```
Log rotation is configured in `docker-compose.prod.yml` to prevent disk exhaustion (maximum 3 files of 10 MB each).
