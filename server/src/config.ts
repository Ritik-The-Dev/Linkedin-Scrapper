/**
 * src/config.ts
 * Runtime configuration derived from environment variables.
 *
 * Single source of truth for the upload limit, so the multer guard in
 * routes/leads.ts and the INVALID_EXCEL message in app.ts can never disagree.
 */

/** Vercel sets VERCEL=1 in every build and function environment. */
export const IS_VERCEL = process.env['VERCEL'] === '1' || process.env['VERCEL'] === 'true';

const MB = 1024 * 1024;

/**
 * Vercel rejects request bodies larger than ~4.5 MB before the function is
 * even invoked, so the default there is 4 MB — leaves room for multipart
 * overhead, and still fits tens of thousands of usernames in one sheet.
 * A self-hosted process has no such cap, so it keeps the original 10 MB.
 */
const DEFAULT_MAX_UPLOAD_BYTES = IS_VERCEL ? 4 * MB : 10 * MB;

/** Guard rail for a mistyped MAX_UPLOAD_BYTES (memoryStorage buffers the whole file). */
const HARD_CEILING_BYTES = 50 * MB;

function resolveMaxUploadBytes(): number {
  const raw = process.env['MAX_UPLOAD_BYTES']?.trim() ?? '';
  if (raw === '') return DEFAULT_MAX_UPLOAD_BYTES;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `[Config] Ignoring invalid MAX_UPLOAD_BYTES="${raw}" — using ${DEFAULT_MAX_UPLOAD_BYTES} bytes.`
    );
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return Math.min(parsed, HARD_CEILING_BYTES);
}

/** Largest accepted import file, in bytes. */
export const MAX_UPLOAD_BYTES = resolveMaxUploadBytes();

/** Human-readable form of {@link MAX_UPLOAD_BYTES}, e.g. "4 MB" — used in error messages. */
export const MAX_UPLOAD_LABEL = `${Number((MAX_UPLOAD_BYTES / MB).toFixed(1))} MB`;
