/**
 * src/db.ts
 * MongoDB connection management via Mongoose.
 *
 * This module has to serve two very different runtimes:
 *
 *   1. Long-lived server (`npm start` / `npm run dev`) — server.ts awaits
 *      connectDB() once at boot and the pool lives for the whole process.
 *   2. Vercel serverless function — a cold start gets a fresh module registry,
 *      but a warm container reuses it across requests. The connection promise
 *      is therefore cached on globalThis and awaited per request by
 *      `ensureDbConnection`, so one container never opens more than one pool.
 *
 * Nothing here throws at import time. A missing MONGODB_URI has to surface as
 * a normal API error; if it crashed on import it would take down every route
 * in the function — including /health — with an opaque 500.
 */

import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { DatabaseError } from './linkedin/errors.js';

interface ConnectionCache {
  /** Resolves once the pool is ready. Its value is never used — only its settlement. */
  promise: Promise<unknown> | null;
}

const globalForMongoose = globalThis as typeof globalThis & {
  __leadExtractorMongo?: ConnectionCache;
};

// Survives module re-evaluation inside the same warm serverless container.
const cache: ConnectionCache = globalForMongoose.__leadExtractorMongo ?? { promise: null };
globalForMongoose.__leadExtractorMongo = cache;

/** mongoose.ConnectionStates.connected */
const READY_STATE_CONNECTED: number = 1;
/** mongoose.ConnectionStates.connecting */
const READY_STATE_CONNECTING: number = 2;

/**
 * Connect to MongoDB, or reuse the in-flight/established connection.
 * Safe to call on every request — it is a no-op once connected.
 *
 * @throws {DatabaseError} when MONGODB_URI is not configured
 */
export async function connectDB(): Promise<void> {
  const state: number = mongoose.connection.readyState;

  if (state === READY_STATE_CONNECTED) return;

  // A serverless container can be frozen and thawed, or lose its socket,
  // before the 'disconnected' listener below has run. The cached promise is
  // then already resolved, so awaiting it would hand a dead connection to the
  // route and — with bufferCommands disabled — surface as an untyped mongoose
  // crash. Drop the stale promise unless a connect is genuinely still in
  // flight, so the cache heals itself instead of trusting the event.
  if (state !== READY_STATE_CONNECTING) {
    cache.promise = null;
  }

  if (!cache.promise) {
    // Read lazily, not at module load: on Vercel the environment is injected
    // by the platform, and locally dotenv may not have run yet.
    const uri = process.env['MONGODB_URI'] ?? '';

    if (!uri) {
      throw new DatabaseError(
        'MONGODB_URI is not configured. Set it in .env locally, or in the project environment variables when deploying.'
      );
    }

    cache.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10_000,
        // Fail fast instead of silently queueing queries when an invocation
        // starts before the pool is ready.
        bufferCommands: false,
        // A serverless container handles one request at a time; a large pool
        // just burns Atlas connections across concurrent instances.
        maxPoolSize: 5,
      })
      .then((instance) => {
        console.log('[DB] Connected to MongoDB');
        return instance;
      })
      .catch((err: unknown) => {
        // Drop the rejected promise so the next request can retry instead of
        // re-awaiting a permanently failed connection for the container's life.
        cache.promise = null;
        throw err;
      });
  }

  await cache.promise;
}

/**
 * Express middleware: guarantee a database connection before the route runs.
 *
 * Mounted on /api only, so /health stays a true liveness probe that answers
 * even when MongoDB is unreachable.
 */
export async function ensureDbConnection(
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await connectDB();
    next();
  } catch (err: unknown) {
    console.error('[DB] Connection failed:', err instanceof Error ? err.message : err);
    next(
      err instanceof DatabaseError
        ? err
        : new DatabaseError(
            'The database is currently unavailable. Check MONGODB_URI and that this deployment is allowed to connect.'
          )
    );
  }
}

mongoose.connection.on('disconnected', () => {
  // Allow a fresh connect attempt on the next request.
  cache.promise = null;
  console.warn('[DB] MongoDB disconnected');
});

mongoose.connection.on('error', (err: Error) => {
  console.error(`[DB] MongoDB error: ${err.message}`);
});
