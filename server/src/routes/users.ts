import { Router } from 'express';
import * as usersController from '../controllers/usersController.js';

const router = Router();

// GET /api/users - List users (with migration filter)
router.get('/', usersController.list);

// GET /api/users/:id - Get single user
router.get('/:id', usersController.getById);

// POST /api/users - Create new user
router.post('/', usersController.create);

// POST /api/users/import - Bulk import users from CSV
router.post('/import', usersController.importBulk);

// PUT /api/users/:id - Update user
router.put('/:id', usersController.update);

// DELETE /api/users/:id - Delete user
router.delete('/:id', usersController.remove);

export default router;
