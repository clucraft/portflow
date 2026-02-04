import { Router } from 'express';
import * as teamController from '../controllers/teamController.js';

const router = Router();

// GET /api/team - List team members
router.get('/', teamController.list);

// GET /api/team/:id - Get single team member
router.get('/:id', teamController.getById);

// POST /api/team - Create new team member
router.post('/', teamController.create);

// PUT /api/team/:id - Update team member
router.put('/:id', teamController.update);

// DELETE /api/team/:id - Delete team member
router.delete('/:id', teamController.remove);

export default router;
