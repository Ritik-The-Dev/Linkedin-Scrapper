/**
 * src/db.ts
 * MongoDB connection management via Mongoose.
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env['MONGODB_URI'];

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set.');
}

// After the guard above, MONGODB_URI is guaranteed to be a string
const MONGO_URI_SAFE: string = MONGODB_URI;

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI_SAFE, { serverSelectionTimeoutMS: 10_000 });
  isConnected = true;
  console.log('[DB] Connected to MongoDB');
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[DB] MongoDB disconnected');
});

mongoose.connection.on('error', (err: Error) => {
  console.error(`[DB] MongoDB error: ${err.message}`);
});
