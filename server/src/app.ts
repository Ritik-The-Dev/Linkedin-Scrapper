/**
 * src/app.ts
 * Express application factory — separated from server.ts so tests can
 * import the app without binding to a port.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors     from 'cors';
import leadsRouter from './routes/leads.js';
import { ensureDbConnection } from './db.js';
import { MAX_UPLOAD_LABEL } from './config.js';
import { isAppError } from './linkedin/errors.js';

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(cors({
  origin:       process.env['CORS_ORIGIN'] ?? '*',
  methods:      ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ---------------------------------------------------------------------------
// Health check — deliberately mounted before the database gate so it answers
// even when MongoDB is unreachable.
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Every /api request awaits the shared connection first. On a long-lived
// server this is a no-op after boot; in a serverless function it is what makes
// a cold start work without a per-invocation connect.
app.use('/api', ensureDbConnection);

app.use('/api/leads', leadsRouter);

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist' },
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Typed application errors (e.g. DATABASE_ERROR from the connection gate)
  // keep the documented { success, error: { code, message } } shape.
  if (isAppError(err)) {
    res.status(err.httpStatus).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  const multerErr = err as { code?: string; message?: string };

  if (multerErr.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_EXCEL', message: `Uploaded file exceeds the ${MAX_UPLOAD_LABEL} size limit` },
    });
    return;
  }

  if (multerErr.message?.includes('Only .xlsx')) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_EXCEL', message: multerErr.message },
    });
    return;
  }

  console.error('[App] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

export default app;
