/**
 * Jinay Finance AI — Server Entry Point
 * Owner: Jinay Golecha (jinay_golecha)
 */

require('dotenv').config();
const app = require('./app');
const prisma = require('./config/database');
const { startMarketBackgroundWorker, stopMarketBackgroundWorker } = require('./services/marketService');

const PORT = parseInt(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Graceful shutdown handler
const shutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  stopMarketBackgroundWorker();
  await prisma.$disconnect();
  console.log('[Server] Database disconnected. Server stopped.');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

// Start server
const startServer = async () => {
  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('\n╔════════════════════════════════════════════════════════╗');
      console.log('║     FinPro — Personal Finance & Decision Support Platform ║');
      console.log('║     Owner: Jinay Golecha (jinay_golecha)               ║');
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log(`\n🚀 Server running at http://0.0.0.0:${PORT}`);
      console.log(`📋 Environment: ${NODE_ENV}`);
      console.log(`🔒 Auth: JWT + Google OAuth`);
      console.log(`🤖 AI: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY' ? 'Gemini (configured)' : 'Rule-based (configure GEMINI_API_KEY)'}`);
      console.log(`📈 Market: ${process.env.FINNHUB_API_KEY && process.env.FINNHUB_API_KEY !== 'YOUR_FINNHUB_API_KEY' ? 'Finnhub (live)' : 'Reference prices'}`);
      console.log(`\n📡 API Endpoints:`);
      console.log(`   Health:    GET  http://0.0.0.0:${PORT}/api/v1/health`);
      console.log(`   Auth:      POST http://0.0.0.0:${PORT}/api/v1/auth/register`);
      console.log(`   Dashboard: GET  http://0.0.0.0:${PORT}/api/v1/dashboard`);
      console.log(`   Frontend:  http://0.0.0.0:${PORT}/\n`);

      // Proactive 60-second market cache warmup worker
      startMarketBackgroundWorker(60000);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${PORT} is already in use. Kill the process or change PORT in .env`);
        process.exit(1);
      }
      throw err;
    });

    // Asynchronously connect to PostgreSQL with resilient retry loop
    const connectWithRetry = async () => {
      try {
        await prisma.$connect();
        console.log('[Database] Connected to PostgreSQL (Cloud Supabase) ✓');
      } catch (err) {
        console.warn(`[Database] Connection notice: ${err.message}. Retrying in 5s...`);
        setTimeout(connectWithRetry, 5000);
      }
    };
    connectWithRetry();

  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
