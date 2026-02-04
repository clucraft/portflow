import { Router } from 'express';
import * as resourceAccountsController from '../controllers/resourceAccountsController.js';

const router = Router();

// GET /api/resource-accounts - List resource accounts
router.get('/', resourceAccountsController.list);

// GET /api/resource-accounts/:id - Get single resource account
router.get('/:id', resourceAccountsController.getById);

// POST /api/resource-accounts - Create new resource account
router.post('/', resourceAccountsController.create);

// PUT /api/resource-accounts/:id - Update resource account
router.put('/:id', resourceAccountsController.update);

// DELETE /api/resource-accounts/:id - Delete resource account
router.delete('/:id', resourceAccountsController.remove);

export default router;
