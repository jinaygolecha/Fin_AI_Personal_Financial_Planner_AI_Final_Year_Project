# ====================================================================
# FinPro — Production Dockerfile
# Academic Cloud Computing Architecture
# Multi-stage build with Node.js 22 Alpine & Non-Root Security
# ====================================================================

# --------------------------------------------------------------------
# Stage 1: Build & Dependency Resolution
# --------------------------------------------------------------------
FROM node:22-alpine AS builder

# Required by Prisma query engine on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY node-backend/package*.json ./node-backend/

# Install dependencies cleanly
RUN npm --prefix node-backend install --omit=dev

# Copy Prisma schema & migrations, then generate Prisma Client
COPY node-backend/prisma ./node-backend/prisma
RUN cd node-backend && npx prisma generate

# Copy application source code & public frontend assets
COPY node-backend/src ./node-backend/src
COPY frontend/public ./frontend/public

# --------------------------------------------------------------------
# Stage 2: Production Minimal Runtime
# --------------------------------------------------------------------
FROM node:22-alpine AS runner

# Required by Prisma query engine on Alpine Linux
RUN apk add --no-cache openssl libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV STORAGE_LOCAL_DIR=/app/uploads

# Create uploads storage directory and configure permissions for non-root 'node' user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Copy application artifacts from builder stage with appropriate ownership
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node-backend ./node-backend
COPY --chown=node:node --from=builder /app/frontend ./frontend

# Enforce Non-Root user execution for container security
USER node

EXPOSE 5000

# Cloud Readiness & Health Check Probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/v1/health/ready || exit 1

# Start FinPro production server
CMD ["node", "node-backend/src/server.js"]
