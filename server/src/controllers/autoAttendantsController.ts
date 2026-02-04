import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { AutoAttendant } from '../types/index.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.query;

    let sql = `
      SELECT aa.*, ra.upn as resource_account_upn, pn.number as phone_number
      FROM auto_attendants aa
      LEFT JOIN resource_accounts ra ON aa.resource_account_id = ra.id
      LEFT JOIN phone_numbers pn ON aa.phone_number_id = pn.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND aa.migration_id = $${params.length}`;
    }

    sql += ' ORDER BY aa.name ASC';

    const autoAttendants = await query<AutoAttendant>(sql, params);
    res.json(autoAttendants);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const autoAttendants = await query<AutoAttendant>(
      `SELECT aa.*, ra.upn as resource_account_upn, pn.number as phone_number
       FROM auto_attendants aa
       LEFT JOIN resource_accounts ra ON aa.resource_account_id = ra.id
       LEFT JOIN phone_numbers pn ON aa.phone_number_id = pn.id
       WHERE aa.id = $1`,
      [id]
    );

    if (autoAttendants.length === 0) {
      throw ApiError.notFound('Auto Attendant not found');
    }

    res.json(autoAttendants[0]);
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
      timezone,
      business_hours_greeting_text,
      business_hours_menu_options,
      after_hours_greeting_text,
      after_hours_menu_options,
      business_hours_schedule,
      operator_enabled,
      directory_search_enabled,
      notes,
    } = req.body;

    if (!migration_id || !site_id || !name || !timezone) {
      throw ApiError.badRequest('migration_id, site_id, name, and timezone are required');
    }

    const autoAttendants = await query<AutoAttendant>(
      `INSERT INTO auto_attendants (
        migration_id, site_id, name, resource_account_id, phone_number_id,
        language_id, timezone, business_hours_greeting_text, business_hours_menu_options,
        after_hours_greeting_text, after_hours_menu_options, business_hours_schedule,
        operator_enabled, directory_search_enabled, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        migration_id, site_id, name, resource_account_id, phone_number_id,
        language_id || 'en-US', timezone, business_hours_greeting_text,
        JSON.stringify(business_hours_menu_options), after_hours_greeting_text,
        JSON.stringify(after_hours_menu_options), JSON.stringify(business_hours_schedule),
        operator_enabled || false, directory_search_enabled || false, notes,
      ]
    );

    res.status(201).json(autoAttendants[0]);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Build dynamic update
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    const updateableFields = [
      'name', 'resource_account_id', 'phone_number_id', 'language_id', 'timezone',
      'business_hours_greeting_text', 'after_hours_greeting_text',
      'after_hours_action', 'after_hours_target', 'operator_enabled',
      'operator_target_type', 'operator_target_value', 'directory_search_enabled', 'notes',
    ];

    const jsonFields = ['business_hours_menu_options', 'after_hours_menu_options', 'business_hours_schedule', 'holiday_schedules'];

    for (const field of updateableFields) {
      if (body[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(body[field]);
      }
    }

    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(JSON.stringify(body[field]));
      }
    }

    if (fields.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    values.push(id);
    const autoAttendants = await query<AutoAttendant>(
      `UPDATE auto_attendants SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`,
      values
    );

    if (autoAttendants.length === 0) {
      throw ApiError.notFound('Auto Attendant not found');
    }

    res.json(autoAttendants[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM auto_attendants WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Auto Attendant not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
