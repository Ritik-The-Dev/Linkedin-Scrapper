/**
 * src/services/excelImportService.ts
 * Excel / CSV import — parse file, deduplicate, batch-fetch from LinkedIn.
 */

import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import Lead from '../models/Lead.js';
import { fetchLinkedInProfile } from '../linkedin/client.js';
import { parseLinkedInProfile  } from '../linkedin/parser.js';
import { normalizeUsername      } from './leadService.js';
import { InvalidExcelError, ImportError } from '../linkedin/errors.js';
import type { ImportResult, ImportSummary } from '../types.js';

const BATCH_CONCURRENCY = Math.max(parseInt(process.env['BATCH_CONCURRENCY'] ?? '5', 10), 1);
const MAX_ROWS          = 500;

// ---------------------------------------------------------------------------
// File parser
// ---------------------------------------------------------------------------

async function parseFile(buffer: Buffer, originalname: string): Promise<string[]> {
  const ext = (originalname ?? '').split('.').pop()?.toLowerCase() ?? '';

  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    throw new InvalidExcelError(
      `Unsupported file type ".${ext}". Accepted: .xlsx, .xls, .csv`
    );
  }

  const workbook = new ExcelJS.Workbook();

  try {
    if (ext === 'csv') {
      const stream = Readable.from(buffer.toString('utf8'));
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
    }
  } catch (err) {
    throw new InvalidExcelError(`Failed to parse file: ${(err as Error).message}`);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new InvalidExcelError('File contains no worksheets.');

  // Find header row — first row containing a cell with text "username"
  let headerRow  = -1;
  let usernameCol = -1;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRow !== -1) return;
    const values = row.values as (ExcelJS.CellValue | undefined)[];
    for (let i = 1; i < values.length; i++) {
      const cell = values[i];
      const text = (typeof cell === 'string' ? cell : (cell as { text?: string })?.text ?? String(cell ?? '')).trim().toLowerCase();
      if (text === 'username') {
        headerRow   = rowNumber;
        usernameCol = i;
        return;
      }
    }
  });

  if (usernameCol === -1) {
    throw new InvalidExcelError(
      'No "username" column found. The file must contain a column named "username".'
    );
  }

  const usernames: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const cell = row.getCell(usernameCol);
    const val  = (typeof cell.value === 'string' ? cell.value : String(cell.value ?? '')).trim();
    usernames.push(val);
  });

  return usernames;
}

// ---------------------------------------------------------------------------
// Concurrency helper — process N items in parallel with a cap
// ---------------------------------------------------------------------------

async function pLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<ImportResult>
): Promise<ImportResult[]> {
  const results: ImportResult[] = new Array(items.length);
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i    = idx++;
      const item = items[i]!;
      results[i] = await fn(item);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    worker
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Single-username processor
// ---------------------------------------------------------------------------

async function processUsername(username: string): Promise<ImportResult> {
  // Check DB first
  try {
    const existing = await Lead.findOne({ username });
    if (existing) {
      return { username, status: 'exists', leadId: existing._id.toString() };
    }
  } catch {
    return { username, status: 'failed', error: 'DATABASE_ERROR' };
  }

  // Fetch from LinkedIn
  let rawJson: Record<string, unknown>;
  try {
    rawJson = await fetchLinkedInProfile(username);
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'LINKEDIN_UPSTREAM_ERROR';
    return { username, status: 'failed', error: code };
  }

  // Parse
  let parsed;
  try {
    parsed = parseLinkedInProfile(rawJson, username);
    if (!parsed?.profile) return { username, status: 'failed', error: 'LINKEDIN_PROFILE_NOT_FOUND' };
  } catch {
    return { username, status: 'failed', error: 'LINKEDIN_UPSTREAM_ERROR' };
  }

  // Store
  const now = new Date();
  try {
    const lead = await Lead.create({
      username, ...parsed,
      firstSeenAt: now, lastSeenAt: now, lastRefreshedAt: now, refreshCount: 0,
    });
    return { username, status: 'created', leadId: lead._id.toString() };
  } catch (err: unknown) {
    const mongoErr = err as { code?: number };
    if (mongoErr.code === 11000) {
      const raceDoc = await Lead.findOne({ username }).catch(() => null);
      if (raceDoc) return { username, status: 'exists', leadId: raceDoc._id.toString() };
    }
    return { username, status: 'failed', error: 'DATABASE_ERROR' };
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function importFromFile(
  buffer: Buffer,
  originalname: string
): Promise<{ summary: ImportSummary; results: ImportResult[] }> {
  const rawUsernames = await parseFile(buffer, originalname);

  const totalRows = rawUsernames.length;
  if (totalRows === 0) throw new InvalidExcelError('The file contains no data rows.');
  if (totalRows > MAX_ROWS) throw new InvalidExcelError(`File has ${totalRows} rows. Maximum is ${MAX_ROWS}.`);

  // Normalize, validate, deduplicate
  const seen            = new Set<string>();
  const uniqueUsernames: string[] = [];

  for (const raw of rawUsernames) {
    if (!raw) continue;
    let normalized: string;
    try { normalized = normalizeUsername(raw); } catch { continue; }
    if (!normalized || !/^[a-z0-9\-_.]{1,100}$/.test(normalized)) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueUsernames.push(normalized);
    }
  }

  if (uniqueUsernames.length === 0) {
    throw new InvalidExcelError('No valid usernames found after normalization.');
  }

  let results: ImportResult[];
  try {
    results = await pLimit(uniqueUsernames, BATCH_CONCURRENCY, processUsername);
  } catch (err) {
    throw new ImportError(`Batch processing failed: ${(err as Error).message}`);
  }

  const summary: ImportSummary = {
    totalRows,
    uniqueUsernames: uniqueUsernames.length,
    alreadyExists:   results.filter(r => r.status === 'exists').length,
    created:         results.filter(r => r.status === 'created').length,
    failed:          results.filter(r => r.status === 'failed').length,
  };

  return { summary, results };
}
