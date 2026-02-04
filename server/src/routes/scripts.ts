import { Router } from 'express';
import * as scriptsController from '../controllers/scriptsController.js';

const router = Router();

// GET /api/scripts - List generated scripts
router.get('/', scriptsController.list);

// GET /api/scripts/:id - Get single script
router.get('/:id', scriptsController.getById);

// POST /api/scripts/generate/user-assignments - Generate user number assignment script
router.post('/generate/user-assignments', scriptsController.generateUserAssignments);

// POST /api/scripts/generate/resource-accounts - Generate resource account creation script
router.post('/generate/resource-accounts', scriptsController.generateResourceAccounts);

// POST /api/scripts/generate/auto-attendant/:id - Generate AA creation script
router.post('/generate/auto-attendant/:id', scriptsController.generateAutoAttendant);

// POST /api/scripts/generate/call-queue/:id - Generate CQ creation script
router.post('/generate/call-queue/:id', scriptsController.generateCallQueue);

// POST /api/scripts/generate/full-migration/:migrationId - Generate full migration script
router.post('/generate/full-migration/:migrationId', scriptsController.generateFullMigration);

// DELETE /api/scripts/:id - Delete script
router.delete('/:id', scriptsController.remove);

export default router;
