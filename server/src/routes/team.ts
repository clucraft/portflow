import { Router } from 'express';
import * as teamController from '../controllers/teamController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/team - List team members
router.get('/', teamController.list);

// GET /api/team/:id - Get single team member
router.get('/:id', teamController.getById);

// POST /api/team - Create new team member
router.post('/', requireAdmin, teamController.create);

// PUT /api/team/:id - Update team member
router.put('/:id', requireAdmin, teamController.update);

// POST /api/team/:id/reset-password - Reset password (admin only)
router.post('/:id/reset-password', requireAdmin, teamController.resetPassword);

// DELETE /api/team/:id - Delete team member
router.delete('/:id', requireAdmin, teamController.remove);

export default router;
