import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/audit.js';

interface VoiceRoutingPolicy {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DialPlan {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ========= Voice Routing Policies =========

export const listVoiceRoutingPolicies = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policies = await query<VoiceRoutingPolicy>(
      'SELECT * FROM voice_routing_policies WHERE is_active = true ORDER BY name ASC'
    );
    res.json(policies);
  } catch (err) {
    next(err);
  }
};

export const createVoiceRoutingPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) throw ApiError.badRequest('name is required');

    const policies = await query<VoiceRoutingPolicy>(
      'INSERT INTO voice_routing_policies (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );

    logActivity(req.user?.id || null, 'vrp.create', `Created voice routing policy: ${policies[0].name}`).catch(() => {});

    res.status(201).json(policies[0]);
  } catch (err) {
    next(err);
  }
};

export const updateVoiceRoutingPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const policies = await query<VoiceRoutingPolicy>(
      `UPDATE voice_routing_policies SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4 RETURNING *`,
      [name, description, is_active, id]
    );

    if (policies.length === 0) throw ApiError.notFound('Voice routing policy not found');

    logActivity(req.user?.id || null, 'vrp.update', `Updated voice routing policy: ${policies[0].name}`).catch(() => {});

    res.json(policies[0]);
  } catch (err) {
    next(err);
  }
};

export const removeVoiceRoutingPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE voice_routing_policies SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.length === 0) throw ApiError.notFound('Voice routing policy not found');

    logActivity(req.user?.id || null, 'vrp.deactivate', `Deactivated voice routing policy: ${id}`).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ========= Dial Plans =========

export const listDialPlans = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await query<DialPlan>(
      'SELECT * FROM dial_plans WHERE is_active = true ORDER BY name ASC'
    );
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

export const createDialPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) throw ApiError.badRequest('name is required');

    const plans = await query<DialPlan>(
      'INSERT INTO dial_plans (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );

    logActivity(req.user?.id || null, 'dialplan.create', `Created dial plan: ${plans[0].name}`).catch(() => {});

    res.status(201).json(plans[0]);
  } catch (err) {
    next(err);
  }
};

export const updateDialPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const plans = await query<DialPlan>(
      `UPDATE dial_plans SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active),
        updated_at = NOW()
      WHERE id = $4 RETURNING *`,
      [name, description, is_active, id]
    );

    if (plans.length === 0) throw ApiError.notFound('Dial plan not found');

    logActivity(req.user?.id || null, 'dialplan.update', `Updated dial plan: ${plans[0].name}`).catch(() => {});

    res.json(plans[0]);
  } catch (err) {
    next(err);
  }
};

export const removeDialPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE dial_plans SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.length === 0) throw ApiError.notFound('Dial plan not found');

    logActivity(req.user?.id || null, 'dialplan.deactivate', `Deactivated dial plan: ${id}`).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ========= Bulk Import =========

export const importVoiceRoutingPolicies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { policies } = req.body;
    if (!Array.isArray(policies) || policies.length === 0) {
      throw ApiError.badRequest('policies array is required and must not be empty');
    }

    let success = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < policies.length; i++) {
      try {
        const { name, description } = policies[i];
        if (!name) {
          failed++;
          errors.push({ row: i + 1, error: 'name is required' });
          continue;
        }

        const existing = await query<VoiceRoutingPolicy>(
          'SELECT id FROM voice_routing_policies WHERE name = $1 AND is_active = true',
          [name]
        );

        if (existing.length > 0) {
          success++;
          continue;
        }

        await query(
          'INSERT INTO voice_routing_policies (name, description) VALUES ($1, $2)',
          [name, description || null]
        );
        success++;
      } catch (err) {
        failed++;
        errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    logActivity(req.user?.id || null, 'vrp.import', `Imported voice routing policies: ${success} success, ${failed} failed`).catch(() => {});

    res.json({ success, failed, errors });
  } catch (err) {
    next(err);
  }
};

export const importDialPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { policies } = req.body;
    if (!Array.isArray(policies) || policies.length === 0) {
      throw ApiError.badRequest('policies array is required and must not be empty');
    }

    let success = 0;
    let failed = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < policies.length; i++) {
      try {
        const { name, description } = policies[i];
        if (!name) {
          failed++;
          errors.push({ row: i + 1, error: 'name is required' });
          continue;
        }

        const existing = await query<DialPlan>(
          'SELECT id FROM dial_plans WHERE name = $1 AND is_active = true',
          [name]
        );

        if (existing.length > 0) {
          success++;
          continue;
        }

        await query(
          'INSERT INTO dial_plans (name, description) VALUES ($1, $2)',
          [name, description || null]
        );
        success++;
      } catch (err) {
        failed++;
        errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    logActivity(req.user?.id || null, 'dialplan.import', `Imported dial plans: ${success} success, ${failed} failed`).catch(() => {});

    res.json({ success, failed, errors });
  } catch (err) {
    next(err);
  }
};
