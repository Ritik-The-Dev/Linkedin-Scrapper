/**
 * src/routes/leads.ts
 * Express router for /api/leads.
 * Literal routes MUST be registered before /:username wildcard.
 */

import { Router } from 'express';
import multer     from 'multer';
import * as ctrl  from '../controllers/leadController.js';
import { MAX_UPLOAD_BYTES } from '../config.js';

const router = Router();

// In-memory file storage — no disk writes (a serverless filesystem is read-only
// apart from /tmp, and the parser only ever needs the buffer).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname ?? '').split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return cb(null, true);
    cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
  },
});

// ---------------------------------------------------------------------------
// Literal paths — registered BEFORE /:username wildcard
// ---------------------------------------------------------------------------
router.post('/import',  upload.single('file'), ctrl.importLeads);
router.get('/search',   ctrl.searchLeads);
router.get('/stats',    ctrl.getStats);

// ---------------------------------------------------------------------------
// Base collection
// ---------------------------------------------------------------------------
router.post('/',  ctrl.createLead);
router.get('/',   ctrl.listLeads);

// ---------------------------------------------------------------------------
// Parameterized routes
// ---------------------------------------------------------------------------
router.get('/:username',         ctrl.getLead);
router.post('/:username/refresh', ctrl.refreshLead);
router.delete('/:username',      ctrl.deleteLead);

export default router;
