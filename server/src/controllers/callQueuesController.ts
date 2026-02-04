import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { CallQueue } from '../types/index.js';

interface CallQueueWithAgents extends CallQueue {
  agents?: Array<{ id: string; display_name: string; upn: string }>;
}

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.query;

    let sql = `
      SELECT cq.*, ra.upn as resource_account_upn, pn.number as phone_number,
             (SELECT COUNT(*) FROM call_queue_agents WHERE call_queue_id = cq.id) as agent_count
      FROM call_queues cq
      LEFT JOIN resource_accounts ra ON cq.resource_account_id = ra.id
      LEFT JOIN phone_numbers pn ON cq.phone_number_id = pn.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND cq.migration_id = $${params.length}`;
    }

    sql += ' ORDER BY cq.name ASC';

    const callQueues = await query<CallQueue>(sql, params);
    res.json(callQueues);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const callQueues = await query<CallQueue>(
      `SELECT cq.*, ra.upn as resource_account_upn, pn.number as phone_number
       FROM call_queues cq
       LEFT JOIN resource_accounts ra ON cq.resource_account_id = ra.id
       LEFT JOIN phone_numbers pn ON cq.phone_number_id = pn.id
       WHERE cq.id = $1`,
      [id]
    );

    if (callQueues.length === 0) {
      throw ApiError.notFound('Call Queue not found');
    }

    // Get agents
    const agents = await query<{ id: string; display_name: string; upn: string }>(
      `SELECT eu.id, eu.display_name, eu.upn
       FROM call_queue_agents cqa
       JOIN end_users eu ON cqa.user_id = eu.id
       WHERE cqa.call_queue_id = $1`,
      [id]
    );

    const result: CallQueueWithAgents = { ...callQueues[0], agents };
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      migration_id,
      site_id,
      name,
      resource_account_id,
      phone_number_id,
      language_id,
      routing_method,
      presence_based_routing,
      conference_mode,
      agent_alert_time,
      allow_opt_out,
      overflow_threshold,
      overflow_action,
      timeout_threshold,
      timeout_action,
      greeting_text,
      notes,
    } = req.body;

    if (!migration_id || !site_id || !name) {
      throw ApiError.badRequest('migration_id, site_id, and name are required');
    }

    const callQueues = await query<CallQueue>(
      `INSERT INTO call_queues (
        migration_id, site_id, name, resource_account_id, phone_number_id,
        language_id, routing_method, presence_based_routing, conference_mode,
        agent_alert_time, allow_opt_out, overflow_threshold, overflow_action,
        timeout_threshold, timeout_action, greeting_text, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        migration_id, site_id, name, resource_account_id, phone_number_id,
        language_id || 'en-US', routing_method || 'attendant',
        presence_based_routing ?? true, conference_mode ?? true,
        agent_alert_time || 30, allow_opt_out ?? true,
        overflow_threshold || 50, overflow_action || 'disconnect',
        timeout_threshold || 1200, timeout_action || 'disconnect',
        greeting_text, notes,
      ]
    );

    res.status(201).json(callQueues[0]);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    const updateableFields = [
      'name', 'resource_account_id', 'phone_number_id', 'language_id',
      'routing_method', 'presence_based_routing', 'conference_mode',
      'agent_alert_time', 'allow_opt_out', 'overflow_threshold', 'overflow_action',
      'overflow_target_type', 'overflow_target_value', 'timeout_threshold',
      'timeout_action', 'timeout_target_type', 'timeout_target_value',
      'greeting_type', 'greeting_text', 'music_on_hold_type', 'notes',
    ];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(body[field]);
      }
    }

    if (fields.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    values.push(id);
    const callQueues = await query<CallQueue>(
      `UPDATE call_queues SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    if (callQueues.length === 0) {
      throw ApiError.notFound('Call Queue not found');
    }

    res.json(callQueues[0]);
  } catch (err) {
    next(err);
  }
};

export const addAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      throw ApiError.badRequest('user_ids array is required');
    }

    // Verify call queue exists
    const cqs = await query('SELECT id FROM call_queues WHERE id = $1', [id]);
    if (cqs.length === 0) {
      throw ApiError.notFound('Call Queue not found');
    }

    const results = { added: 0, skipped: 0 };

    for (const userId of user_ids) {
      try {
        await query(
          `INSERT INTO call_queue_agents (call_queue_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (call_queue_id, user_id) DO NOTHING`,
          [id, userId]
        );
        results.added++;
      } catch {
        results.skipped++;
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
};

export const removeAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, userId } = req.params;

    const result = await query(
      'DELETE FROM call_queue_agents WHERE call_queue_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.length === 0) {
      throw ApiError.notFound('Agent not found in this Call Queue');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM call_queues WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Call Queue not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
