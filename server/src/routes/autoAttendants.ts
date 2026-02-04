import { Router } from 'express';
import * as autoAttendantsController from '../controllers/autoAttendantsController.js';

const router = Router();

// GET /api/auto-attendants - List auto attendants
router.get('/', autoAttendantsController.list);

// GET /api/auto-attendants/:id - Get single auto attendant
router.get('/:id', autoAttendantsController.getById);

// POST /api/auto-attendants - Create new auto attendant
router.post('/', autoAttendantsController.create);

// PUT /api/auto-attendants/:id - Update auto attendant
router.put('/:id', autoAttendantsController.update);

// DELETE /api/auto-attendants/:id - Delete auto attendant
router.delete('/:id', autoAttendantsController.remove);

export default router;
