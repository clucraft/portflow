import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { PhoneNumber, PortingStatus } from '../types/index.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, status, type } = req.query;

    let sql = `
      SELECT pn.*, eu.display_name as assigned_user_name, ra.display_name as assigned_resource_name
      FROM phone_numbers pn
      LEFT JOIN end_users eu ON pn.assigned_user_id = eu.id
      LEFT JOIN resource_accounts ra ON pn.assigned_resource_account_id = ra.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND pn.migration_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND pn.porting_status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND pn.number_type = $${params.length}`;
    }

    sql += ' ORDER BY pn.number ASC';

    const numbers = await query<PhoneNumber>(sql, params);
    res.json(numbers);
  } catch (err) {
    next(err);
  }
};

export const listUnassigned = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.query;

    let sql = 'SELECT * FROM unassigned_numbers WHERE 1=1';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND migration_id = $${params.length}`;
    }

    const numbers = await query<PhoneNumber>(sql, params);
    res.json(numbers);
  } catch (err) {
    next(err);
  }
};

export const portingSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.query;

    let sql = 'SELECT * FROM porting_status_summary';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql = `SELECT porting_status, COUNT(*) as count
             FROM phone_numbers
             WHERE migration_id = $1
             GROUP BY porting_status`;
    }

    const summary = await query(sql, params);
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const numbers = await query<PhoneNumber>(
      `SELECT pn.*, eu.display_name as assigned_user_name, ra.display_name as assigned_resource_name
       FROM phone_numbers pn
       LEFT JOIN end_users eu ON pn.assigned_user_id = eu.id
       LEFT JOIN resource_accounts ra ON pn.assigned_resource_account_id = ra.id
       WHERE pn.id = $1`,
      [id]
    );

    if (numbers.length === 0) {
      throw ApiError.notFound('Phone number not found');
    }

    res.json(numbers[0]);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      migration_id,
      site_id,
      number,
      number_type,
      original_carrier,
      notes,
    } = req.body;

    if (!migration_id || !site_id || !number) {
      throw ApiError.badRequest('migration_id, site_id, and number are required');
    }

    // Validate E.164 format
    if (!/^\+[1-9]\d{1,14}$/.test(number)) {
      throw ApiError.badRequest('Phone number must be in E.164 format (e.g., +12125551234)');
    }

    const numbers = await query<PhoneNumber>(
      `INSERT INTO phone_numbers (migration_id, site_id, number, number_type, original_carrier, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [migration_id, site_id, number, number_type || 'user', original_carrier, notes]
    );

    res.status(201).json(numbers[0]);
  } catch (err) {
    next(err);
  }
};

export const importBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, site_id, numbers } = req.body;

    if (!migration_id || !site_id || !Array.isArray(numbers)) {
      throw ApiError.badRequest('migration_id, site_id, and numbers array are required');
    }

    const results = { success: 0, failed: 0, errors: [] as { row: number; error: string }[] };

    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i];
      try {
        // Normalize to E.164 if needed
        let phoneNumber = num.number.replace(/\D/g, '');
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = '+' + phoneNumber;
        }

        await query(
          `INSERT INTO phone_numbers (migration_id, site_id, number, number_type, original_carrier)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (number) DO UPDATE SET
             number_type = COALESCE(EXCLUDED.number_type, phone_numbers.number_type),
             original_carrier = COALESCE(EXCLUDED.original_carrier, phone_numbers.original_carrier)`,
          [migration_id, site_id, phoneNumber, num.number_type || 'user', num.original_carrier]
        );
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 1, error: (err as Error).message });
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { number_type, original_carrier, online_voice_routing_policy, notes } = req.body;

    const numbers = await query<PhoneNumber>(
      `UPDATE phone_numbers SET
        number_type = COALESCE($1, number_type),
        original_carrier = COALESCE($2, original_carrier),
        online_voice_routing_policy = COALESCE($3, online_voice_routing_policy),
        notes = COALESCE($4, notes)
      WHERE id = $5
      RETURNING *`,
      [number_type, original_carrier, online_voice_routing_policy, notes, id]
    );

    if (numbers.length === 0) {
      throw ApiError.notFound('Phone number not found');
    }

    res.json(numbers[0]);
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, foc_date, port_date, rejection_reason } = req.body;

    const validStatuses: PortingStatus[] = [
      'not_started', 'loa_submitted', 'loa_rejected', 'foc_received',
      'port_scheduled', 'ported', 'verified', 'failed',
    ];

    if (!validStatuses.includes(status)) {
      throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updateFields: string[] = ['porting_status = $1'];
    const params: unknown[] = [status];

    if (status === 'loa_submitted') {
      updateFields.push(`loa_submitted_date = $${params.length + 1}`);
      params.push(new Date());
    }

    if (status === 'loa_rejected' && rejection_reason) {
      updateFields.push(`loa_rejection_reason = $${params.length + 1}`);
      params.push(rejection_reason);
    }

    if (status === 'foc_received' && foc_date) {
      updateFields.push(`foc_date = $${params.length + 1}`);
      params.push(foc_date);
    }

    if ((status === 'port_scheduled' || status === 'foc_received') && port_date) {
      updateFields.push(`port_date = $${params.length + 1}`);
      params.push(port_date);
    }

    if (status === 'ported') {
      updateFields.push(`ported_date = $${params.length + 1}`);
      params.push(new Date());
    }

    if (status === 'verified') {
      updateFields.push(`verified_date = $${params.length + 1}`);
      params.push(new Date());
    }

    params.push(id);

    const numbers = await query<PhoneNumber>(
      `UPDATE phone_numbers SET ${updateFields.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (numbers.length === 0) {
      throw ApiError.notFound('Phone number not found');
    }

    res.json(numbers[0]);
  } catch (err) {
    next(err);
  }
};

export const assign = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { user_id, resource_account_id } = req.body;

    if (user_id && resource_account_id) {
      throw ApiError.badRequest('Cannot assign to both user and resource account');
    }

    const numbers = await query<PhoneNumber>(
      `UPDATE phone_numbers SET
        assigned_user_id = $1,
        assigned_resource_account_id = $2
      WHERE id = $3
      RETURNING *`,
      [user_id || null, resource_account_id || null, id]
    );

    if (numbers.length === 0) {
      throw ApiError.notFound('Phone number not found');
    }

    res.json(numbers[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM phone_numbers WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Phone number not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
