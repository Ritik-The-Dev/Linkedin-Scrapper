/**
 * server/api/index.ts
 *
 * Vercel serverless function entry point.
 *
 * @vercel/node compiles this TypeScript directly — no manual tsc needed.
 * In production, Vercel injects env vars; dotenv is a no-op.
 * Locally with `vercel dev`, dotenv reads the .env file.
 *
 * MongoDB connection is established lazily and reused across warm invocations.
 */

import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import mongoose from 'mongoose';
import app from '../src/app.js';

// ---------------------------------------------------------------------------
// Lazy MongoDB — reused across warm Lambda invocations
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env['MONGODB_URI'] ?? '';

let connectionPromise: Promise<void> | null = null;

async function ensureConnected(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;  // already open

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        bufferCommands: false,
      })
      .then(() => { console.log('[Vercel] MongoDB connected'); })
      .catch((err: Error) => {
        connectionPromise = null;  // allow retry next invocation
        throw err;
      });
  }

  await connectionPromise;
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    await ensureConnected();
  } catch (err) {
    console.error('[Vercel] MongoDB connect failed:', (err as Error).message);
    // Continue — requests that don't need DB will still work;
    // those that do will get a DATABASE_ERROR from the service layer.
  }

  (app as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
