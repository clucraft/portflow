import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Public endpoints (no auth required)
router.post('/login', authController.login);
router.post('/setup', authController.setup);
router.get('/check-setup', authController.checkSetup);

// Protected endpoints
router.get('/me', requireAuth, authController.me);
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
