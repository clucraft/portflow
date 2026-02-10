import { Router } from 'express';
import * as carriersController from '../controllers/carriersController.js';

const router = Router();

// GET /api/carriers - List active carriers (for form dropdowns)
router.get('/', carriersController.list);

export default router;
