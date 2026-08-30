/**
 * src/server.ts
 * Entry point — loads .env, connects to MongoDB, starts HTTP server.
 */
// import dns from "node:dns";

// dns.setServers(["1.1.1.1", "8.8.8.8"]);

import 'dotenv/config';
import { connectDB } from './db.js';
import app           from './app.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

async function start(): Promise<void> {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[Server] LinkedIn Lead Extractor running on port ${PORT}`);
    console.log(`[Server] Health: http://localhost:${PORT}/health`);
    console.log(`[Server] API:    http://localhost:${PORT}/api/leads`);
  });
}

start().catch((err: Error) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});
