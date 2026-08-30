/**
 * src/controllers/leadController.ts
 * HTTP layer — validate inputs, call services, format responses.
 */

import type { Request, Response } from 'express';
import * as leadService       from '../services/leadService.js';
import { importFromFile }     from '../services/excelImportService.js';
import {
  InvalidUsernameError,
  isAppError,
} from '../linkedin/errors.js';
import type { PaginationMeta } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESERVED = new Set(['search', 'import', 'stats']);

function validateUsername(raw: unknown): string {
  if (!raw || typeof raw !== 'string') throw new InvalidUsernameError('username is required');
  const normalized = raw.trim().toLowerCase();
  if (!normalized)                     throw new InvalidUsernameError('username must not be empty');
  if (normalized.length > 100)         throw new InvalidUsernameError('username must be 100 characters or fewer');
  if (!/^[a-z0-9\-_.]+$/.test(normalized)) {
    throw new InvalidUsernameError('username may only contain letters, numbers, hyphens, underscores, and dots');
  }
  if (RESERVED.has(normalized)) {
    throw new InvalidUsernameError(`"${normalized}" is a reserved word`);
  }
  return normalized;
}

function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages     = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage:     page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function handleError(err: unknown, res: Response): void {
  if (isAppError(err)) {
    res.status(err.httpStatus).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }
  console.error('[Controller] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

// ---------------------------------------------------------------------------
// POST /api/leads
// ---------------------------------------------------------------------------

export async function createLead(req: Request, res: Response): Promise<void> {
  let username: string;
  try {
    username = validateUsername((req.body as Record<string, unknown>)?.['username']);
  } catch (err) {
    handleError(err, res);
    return;
  }

  try {
    const { lead, source } = await leadService.createOrFetchLead(username);
    const status = source === 'linkedin' ? 201 : 200;
    res.status(status).json({ success: true, source, data: lead });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads
// ---------------------------------------------------------------------------

export async function listLeads(req: Request, res: Response): Promise<void> {
  const page  = Math.max(parseInt(String(req.query['page']  ?? 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? 10), 10) || 10, 1), 10);

  try {
    const { leads, total } = await leadService.listLeads(page, limit);
    res.status(200).json({
      success: true,
      data: leads,
      pagination: buildPagination(page, limit, total),
    });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/search
// ---------------------------------------------------------------------------

export async function searchLeads(req: Request, res: Response): Promise<void> {
  const q = String(req.query['q'] ?? '').trim();
  if (!q) {
    res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Query parameter "q" is required' } });
    return;
  }

  const page  = Math.max(parseInt(String(req.query['page']  ?? 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query['limit'] ?? 10), 10) || 10, 1), 10);

  try {
    const { leads, total } = await leadService.searchLeads(q, page, limit);
    res.status(200).json({
      success: true,
      data: leads,
      pagination: buildPagination(page, limit, total),
    });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/stats
// ---------------------------------------------------------------------------

export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await leadService.getStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/:username
// ---------------------------------------------------------------------------

export async function getLead(req: Request, res: Response): Promise<void> {
  let username: string;
  try {
    username = validateUsername(req.params['username']);
  } catch (err) {
    handleError(err, res);
    return;
  }

  try {
    const lead = await leadService.getLeadByUsername(username);
    res.status(200).json({ success: true, data: lead });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// POST /api/leads/:username/refresh
// ---------------------------------------------------------------------------

export async function refreshLead(req: Request, res: Response): Promise<void> {
  let username: string;
  try {
    username = validateUsername(req.params['username']);
  } catch (err) {
    handleError(err, res);
    return;
  }

  try {
    const lead = await leadService.refreshLead(username);
    res.status(200).json({ success: true, data: lead });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/leads/:username
// ---------------------------------------------------------------------------

export async function deleteLead(req: Request, res: Response): Promise<void> {
  let username: string;
  try {
    username = validateUsername(req.params['username']);
  } catch (err) {
    handleError(err, res);
    return;
  }

  try {
    const result = await leadService.deleteLead(username);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    handleError(err, res);
  }
}

// ---------------------------------------------------------------------------
// POST /api/leads/import
// ---------------------------------------------------------------------------

export async function importLeads(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_REQUEST', message: 'No file uploaded. Send the file as multipart/form-data field "file".' },
    });
    return;
  }

  try {
    const { summary, results } = await importFromFile(req.file.buffer, req.file.originalname);
    res.status(200).json({ success: true, summary, results });
  } catch (err) {
    handleError(err, res);
  }
}
