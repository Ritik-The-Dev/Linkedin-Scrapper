/**
 * src/services/leadService.ts
 * Business logic — MongoDB orchestration and LinkedIn client calls.
 */

import Lead, { type ILead } from '../models/Lead.js';
import { fetchLinkedInProfile } from '../linkedin/client.js';
import { parseLinkedInProfile } from '../linkedin/parser.js';
import {
  LeadNotFoundError,
  DatabaseError,
  LinkedInProfileNotFoundError,
} from '../linkedin/errors.js';
import type { StatsData } from '../types.js';

// ---------------------------------------------------------------------------
// Username normalization
// ---------------------------------------------------------------------------

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// createOrFetchLead
// ---------------------------------------------------------------------------

export async function createOrFetchLead(
  rawUsername: string
): Promise<{ lead: ILead; source: 'linkedin' | 'database' }> {
  const username = normalizeUsername(rawUsername);

  // 1. Check MongoDB first
  let existing: ILead | null;
  try {
    existing = await Lead.findOne({ username });
  } catch (err) {
    throw new DatabaseError(`MongoDB lookup failed: ${(err as Error).message}`);
  }

  if (existing) {
    try {
      existing.lastSeenAt = new Date();
      await existing.save();
    } catch (err) {
      throw new DatabaseError(`Failed to update lastSeenAt: ${(err as Error).message}`);
    }
    return { lead: existing, source: 'database' };
  }

  // 2. Fetch from LinkedIn (throws typed errors on failure)
  const rawJson = await fetchLinkedInProfile(username);
  const parsed  = parseLinkedInProfile(rawJson, username);

  if (!parsed?.profile) {
    throw new LinkedInProfileNotFoundError(username);
  }

  // 3. Persist
  const now = new Date();
  let lead: ILead;
  try {
    lead = await Lead.create({
      username,
      ...parsed,
      firstSeenAt:     now,
      lastSeenAt:      now,
      lastRefreshedAt: now,
      refreshCount:    0,
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      // Race condition — another request already inserted this username
      const raceDoc = await Lead.findOne({ username }).catch(() => null);
      if (raceDoc) {
        raceDoc.lastSeenAt = now;
        await raceDoc.save().catch(() => null);
        return { lead: raceDoc, source: 'database' };
      }
    }
    throw new DatabaseError(`Failed to create lead: ${mongoErr.message ?? 'unknown'}`);
  }

  return { lead, source: 'linkedin' };
}

// ---------------------------------------------------------------------------
// getLeadByUsername
// ---------------------------------------------------------------------------

export async function getLeadByUsername(rawUsername: string): Promise<ILead> {
  const username = normalizeUsername(rawUsername);

  let lead: ILead | null;
  try {
    lead = await Lead.findOne({ username });
  } catch (err) {
    throw new DatabaseError(`MongoDB lookup failed: ${(err as Error).message}`);
  }

  if (!lead) throw new LeadNotFoundError(username);

  try {
    lead.lastSeenAt = new Date();
    await lead.save();
  } catch (err) {
    throw new DatabaseError(`Failed to update lastSeenAt: ${(err as Error).message}`);
  }

  return lead;
}

// ---------------------------------------------------------------------------
// listLeads
// ---------------------------------------------------------------------------

export async function listLeads(
  page = 1,
  limit = 10
): Promise<{ leads: ILead[]; total: number; page: number; limit: number }> {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const safePage  = Math.max(Number(page)  || 1,  1);
  const skip      = (safePage - 1) * safeLimit;

  let leads: ILead[], total: number;
  try {
    [leads, total] = await Promise.all([
      Lead.find({}).sort({ lastSeenAt: -1 }).skip(skip).limit(safeLimit),
      Lead.countDocuments({}),
    ]);
  } catch (err) {
    throw new DatabaseError(`Failed to list leads: ${(err as Error).message}`);
  }

  return { leads, total, page: safePage, limit: safeLimit };
}

// ---------------------------------------------------------------------------
// searchLeads
// ---------------------------------------------------------------------------

export async function searchLeads(
  q: string,
  page = 1,
  limit = 10
): Promise<{ leads: ILead[]; total: number; page: number; limit: number }> {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 10);
  const safePage  = Math.max(Number(page)  || 1, 1);
  const skip      = (safePage - 1) * safeLimit;

  // Escape special regex chars to prevent injection
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex   = new RegExp(escaped, 'i');

  const filter = {
    $or: [
      { username:            regex },
      { 'profile.firstName': regex },
      { 'profile.lastName':  regex },
      { 'profile.headline':  regex },
    ],
  };

  let leads: ILead[], total: number;
  try {
    [leads, total] = await Promise.all([
      Lead.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(safeLimit),
      Lead.countDocuments(filter),
    ]);
  } catch (err) {
    throw new DatabaseError(`Search failed: ${(err as Error).message}`);
  }

  return { leads, total, page: safePage, limit: safeLimit };
}

// ---------------------------------------------------------------------------
// refreshLead
// ---------------------------------------------------------------------------

export async function refreshLead(rawUsername: string): Promise<ILead> {
  const username = normalizeUsername(rawUsername);

  // Lead must already exist
  let existing: ILead | null;
  try {
    existing = await Lead.findOne({ username });
  } catch (err) {
    throw new DatabaseError(`MongoDB lookup failed: ${(err as Error).message}`);
  }

  if (!existing) throw new LeadNotFoundError(username);

  // Fetch fresh data (typed errors propagate directly)
  const rawJson = await fetchLinkedInProfile(username);
  const parsed  = parseLinkedInProfile(rawJson, username);

  if (!parsed?.profile) throw new LinkedInProfileNotFoundError(username);

  // Update only after successful fetch + parse
  const now = new Date();
  let updated: ILead | null;
  try {
    updated = await Lead.findOneAndUpdate(
      { username },
      {
        $set: {
          ...parsed,
          lastSeenAt:      now,
          lastRefreshedAt: now,
        },
        $inc: { refreshCount: 1 },
      },
      { new: true, runValidators: true }
    );
  } catch (err) {
    throw new DatabaseError(`Failed to update lead after refresh: ${(err as Error).message}`);
  }

  if (!updated) throw new LeadNotFoundError(username);
  return updated;
}

// ---------------------------------------------------------------------------
// deleteLead
// ---------------------------------------------------------------------------

export async function deleteLead(
  rawUsername: string
): Promise<{ username: string; deleted: boolean }> {
  const username = normalizeUsername(rawUsername);

  let result: ILead | null;
  try {
    result = await Lead.findOneAndDelete({ username });
  } catch (err) {
    throw new DatabaseError(`Failed to delete lead: ${(err as Error).message}`);
  }

  if (!result) throw new LeadNotFoundError(username);
  return { username, deleted: true };
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

export async function getStats(): Promise<StatsData> {
  try {
    const [totalLeads, lastImportedDoc, totalRefreshed] = await Promise.all([
      Lead.countDocuments({}),
      Lead.findOne({}).sort({ createdAt: -1 }).select('createdAt').lean(),
      Lead.countDocuments({ refreshCount: { $gte: 1 } }),
    ]);

    return {
      totalLeads,
      lastImportedAt: (lastImportedDoc as { createdAt?: Date } | null)?.createdAt ?? null,
      totalRefreshed,
    };
  } catch (err) {
    throw new DatabaseError(`Failed to fetch stats: ${(err as Error).message}`);
  }
}
