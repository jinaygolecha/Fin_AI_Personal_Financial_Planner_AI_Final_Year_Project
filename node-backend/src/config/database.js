const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error'],
  });
} else {
  // In development, reuse the client to avoid connection pool exhaustion
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['warn', 'error'],
    });
  }
  prisma = global.__prisma;
}

/**
 * Safely extracts diagnostic database connection metadata without exposing passwords.
 * Useful for real cloud health reporting and verification.
 */
prisma.getDatabaseTelemetry = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    return {
      configured: false,
      provider: 'PostgreSQL',
      isCloud: false,
      maskedHost: 'unconfigured',
      database: 'unknown',
      ssl: false,
    };
  }

  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname || '127.0.0.1';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === 'postgres';

    // Mask host if cloud to protect infrastructure identifiers while proving cloud origin
    let maskedHost = host;
    if (!isLocal && host.length > 8) {
      const parts = host.split('.');
      if (parts.length > 2) {
        const first = parts[0];
        const maskedFirst = first.slice(0, 3) + '***' + (first.length > 6 ? first.slice(-2) : '');
        maskedHost = [maskedFirst, ...parts.slice(1)].join('.');
      } else {
        maskedHost = host.slice(0, 3) + '***' + host.slice(-3);
      }
    }

    const sslParam = parsed.searchParams.get('sslmode') || parsed.searchParams.get('ssl');
    const ssl = !!(sslParam && sslParam !== 'disable') || parsed.searchParams.get('sslaccept') === 'strict';
    const pgbouncer = parsed.searchParams.get('pgbouncer') === 'true' || parsed.port === '6543';

    return {
      configured: true,
      provider: 'PostgreSQL',
      isCloud: !isLocal,
      environmentType: !isLocal ? 'cloud' : 'local',
      host: maskedHost,
      port: parsed.port || '5432',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'finance_jinay',
      ssl,
      connectionPooler: pgbouncer,
    };
  } catch {
    return {
      configured: true,
      provider: 'PostgreSQL',
      isCloud: false,
      host: 'custom-connection-string',
      database: 'finance_jinay',
      ssl: false,
    };
  }
};

/**
 * Executes a live health query against PostgreSQL and measures round-trip latency.
 */
prisma.checkHealth = async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    const telemetry = prisma.getDatabaseTelemetry();
    return {
      status: 'connected',
      healthy: true,
      latencyMs,
      ...telemetry,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const telemetry = prisma.getDatabaseTelemetry();
    return {
      status: 'disconnected',
      healthy: false,
      latencyMs,
      error: error.message,
      ...telemetry,
    };
  }
};

module.exports = prisma;
