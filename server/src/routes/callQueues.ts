import { Router } from 'express';
import * as callQueuesController from '../controllers/callQueuesController.js';

const router = Router();

// GET /api/call-queues - List call queues
router.get('/', callQueuesController.list);

// GET /api/call-queues/:id - Get single call queue
router.get('/:id', callQueuesController.getById);

// POST /api/call-queues - Create new call queue
router.post('/', callQueuesController.create);

// PUT /api/call-queues/:id - Update call queue
router.put('/:id', callQueuesController.update);

// POST /api/call-queues/:id/agents - Add agents to call queue
router.post('/:id/agents', callQueuesController.addAgents);

// DELETE /api/call-queues/:id/agents/:userId - Remove agent from call queue
router.delete('/:id/agents/:userId', callQueuesController.removeAgent);

// DELETE /api/call-queues/:id - Delete call queue
router.delete('/:id', callQueuesController.remove);

export default router;
