import { Router } from 'express';
import * as phoneNumbersController from '../controllers/phoneNumbersController.js';

const router = Router();

// GET /api/phone-numbers - List phone numbers (with migration filter)
router.get('/', phoneNumbersController.list);

// GET /api/phone-numbers/unassigned - List unassigned numbers
router.get('/unassigned', phoneNumbersController.listUnassigned);

// GET /api/phone-numbers/porting-summary - Get porting status summary
router.get('/porting-summary', phoneNumbersController.portingSummary);

// GET /api/phone-numbers/:id - Get single phone number
router.get('/:id', phoneNumbersController.getById);

// POST /api/phone-numbers - Create new phone number
router.post('/', phoneNumbersController.create);

// POST /api/phone-numbers/import - Bulk import phone numbers from CSV
router.post('/import', phoneNumbersController.importBulk);

// PUT /api/phone-numbers/:id - Update phone number
router.put('/:id', phoneNumbersController.update);

// PATCH /api/phone-numbers/:id/status - Update porting status
router.patch('/:id/status', phoneNumbersController.updateStatus);

// PATCH /api/phone-numbers/:id/assign - Assign to user or resource account
router.patch('/:id/assign', phoneNumbersController.assign);

// DELETE /api/phone-numbers/:id - Delete phone number
router.delete('/:id', phoneNumbersController.remove);

export default router;
