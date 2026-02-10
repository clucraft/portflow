import { Router } from 'express';
import * as migrationsController from '../controllers/migrationsController.js';
import * as notificationsController from '../controllers/notificationsController.js';

const router = Router();

// GET /api/migrations - List all migrations
router.get('/', migrationsController.list);

// GET /api/migrations/dashboard - Get dashboard view
router.get('/dashboard', migrationsController.dashboard);

// GET /api/migrations/stages - Get workflow stage metadata
router.get('/stages', migrationsController.getWorkflowStages);

// GET /api/migrations/:id - Get single migration
router.get('/:id', migrationsController.getById);

// POST /api/migrations - Create new migration
router.post('/', migrationsController.create);

// PUT /api/migrations/:id - Update migration (general fields)
router.put('/:id', migrationsController.update);

// DELETE /api/migrations/:id - Delete migration
router.delete('/:id', migrationsController.remove);

// === Workflow Stage Transitions ===

// PATCH /api/migrations/:id/stage - Update workflow stage
router.patch('/:id/stage', migrationsController.updateStage);

// === Phase 1: Estimate ===

// PATCH /api/migrations/:id/estimate - Update estimate values
router.patch('/:id/estimate', migrationsController.updateEstimate);

// POST /api/migrations/:id/accept-estimate - Accept estimate (move to phase 2)
router.post('/:id/accept-estimate', migrationsController.acceptEstimate);

// POST /api/migrations/:id/estimate-link - Generate estimate acceptance link for customer
router.post('/:id/estimate-link', migrationsController.generateEstimateLink);

// === Phase 2: Verizon Setup ===

// PATCH /api/migrations/:id/verizon-request - Update Verizon request info
router.patch('/:id/verizon-request', migrationsController.updateVerizonRequest);

// POST /api/migrations/:id/submit-verizon - Submit Verizon request
router.post('/:id/submit-verizon', migrationsController.submitVerizonRequest);

// POST /api/migrations/:id/complete-verizon - Mark Verizon setup complete
router.post('/:id/complete-verizon', migrationsController.completeVerizonSetup);

// === Phase 3: Porting ===

// PATCH /api/migrations/:id/porting - Update porting info
router.patch('/:id/porting', migrationsController.updatePortingInfo);

// POST /api/migrations/:id/submit-loa - Submit LOA
router.post('/:id/submit-loa', migrationsController.submitLoa);

// POST /api/migrations/:id/set-foc - Set FOC date
router.post('/:id/set-foc', migrationsController.setFocDate);

// POST /api/migrations/:id/complete-porting - Mark porting complete
router.post('/:id/complete-porting', migrationsController.completePorting);

// === Phase 4: User Configuration ===

// POST /api/migrations/:id/magic-link - Generate magic link for customer data entry
router.post('/:id/magic-link', migrationsController.generateMagicLink);

// === Notifications ===

// POST /api/migrations/:id/subscribe - Subscribe to notifications
router.post('/:id/subscribe', notificationsController.subscribe);

// DELETE /api/migrations/:id/subscribe - Unsubscribe from notifications
router.delete('/:id/subscribe', notificationsController.unsubscribe);

// GET /api/migrations/:id/subscribers - List subscribers
router.get('/:id/subscribers', notificationsController.getSubscribers);

export default router;
