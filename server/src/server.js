import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

const start = async () => {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    console.log(`✅ Wandr API on http://localhost:${env.PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(async () => { await disconnectDB(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    shutdown('unhandledRejection');
  });
};
start().catch((err) => { console.error('Fatal startup error:', err); process.exit(1); });
