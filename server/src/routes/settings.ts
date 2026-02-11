import { Router } from 'express';
import * as settingsController from '../controllers/settingsController.js';
import * as carriersController from '../controllers/carriersController.js';
import * as policiesController from '../controllers/policiesController.js';
import * as auditController from '../controllers/auditController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// === App Settings ===
router.get('/', settingsController.getAll);

// === Carriers CRUD ===
router.get('/carriers', carriersController.listAll);
router.post('/carriers', requireAdmin, carriersController.create);
router.put('/carriers/:id', requireAdmin, carriersController.update);
router.delete('/carriers/:id', requireAdmin, carriersController.remove);

// === Voice Routing Policies CRUD ===
router.get('/voice-routing-policies', policiesController.listVoiceRoutingPolicies);
router.post('/voice-routing-policies/import', requireAdmin, policiesController.importVoiceRoutingPolicies);
router.post('/voice-routing-policies', requireAdmin, policiesController.createVoiceRoutingPolicy);
router.put('/voice-routing-policies/:id', requireAdmin, policiesController.updateVoiceRoutingPolicy);
router.delete('/voice-routing-policies/:id', requireAdmin, policiesController.removeVoiceRoutingPolicy);

// === Dial Plans CRUD ===
router.get('/dial-plans', policiesController.listDialPlans);
router.post('/dial-plans/import', requireAdmin, policiesController.importDialPlans);
router.post('/dial-plans', requireAdmin, policiesController.createDialPlan);
router.put('/dial-plans/:id', requireAdmin, policiesController.updateDialPlan);
router.delete('/dial-plans/:id', requireAdmin, policiesController.removeDialPlan);

// === Email ===
router.post('/email-relay/test', requireAdmin, settingsController.testEmailRelay);

// === Audit Log ===
router.get('/audit-log', requireAdmin, auditController.list);

// === Settings key-value (must be after specific routes) ===
router.get('/:key', settingsController.get);
router.put('/:key', requireAdmin, settingsController.update);

export default router;
