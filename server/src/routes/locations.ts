import { Router } from 'express';
import * as locationsController from '../controllers/locationsController.js';

const router = Router();

router.get('/', locationsController.list);
router.get('/by-migration/:migration_id', locationsController.getByMigration);
router.post('/', locationsController.create);
router.post('/import/preview', locationsController.importPreview);
router.post('/import', locationsController.importLocations);
router.post('/bulk-delete', locationsController.bulkRemove);
router.post('/kickoff/preview', locationsController.kickoffPreview);
router.post('/kickoff/send', locationsController.kickoffSend);
router.post('/kickoff/mark-sent', locationsController.bulkMarkKickoffSent);
router.get('/:id', locationsController.getById);
router.put('/:id', locationsController.update);
router.delete('/:id', locationsController.remove);
router.post('/:id/link', locationsController.linkMigration);
router.post('/:id/unlink', locationsController.unlinkMigration);

export default router;
