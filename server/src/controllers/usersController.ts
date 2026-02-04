import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { EndUser } from '../types/index.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, configured } = req.query;

    let sql = 'SELECT * FROM end_users WHERE 1=1';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND migration_id = $${params.length}`;
    }

    if (configured !== undefined) {
      params.push(configured === 'true');
      sql += ` AND is_configured = $${params.length}`;
    }

    sql += ' ORDER BY display_name ASC';

    const users = await query<EndUser>(sql, params);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const users = await query<EndUser>('SELECT * FROM end_users WHERE id = $1', [id]);

    if (users.length === 0) {
      throw ApiError.notFound('User not found');
    }

    res.json(users[0]);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      migration_id,
      display_name,
      upn,
      phone_number,
      department,
      job_title,
      notes,
    } = req.body;

    if (!migration_id || !display_name || !upn) {
      throw ApiError.badRequest('migration_id, display_name, and upn are required');
    }

    const users = await query<EndUser>(
      `INSERT INTO end_users (
        migration_id, display_name, upn, phone_number, department, job_title, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [migration_id, display_name, upn, phone_number, department, job_title, notes]
    );

    res.status(201).json(users[0]);
  } catch (err) {
    next(err);
  }
};

export const importBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, users } = req.body;

    if (!migration_id || !Array.isArray(users)) {
      throw ApiError.badRequest('migration_id and users array are required');
    }

    const results = { success: 0, failed: 0, errors: [] as { row: number; error: string }[] };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        await query(
          `INSERT INTO end_users (migration_id, display_name, upn, phone_number, department)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (migration_id, upn) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             phone_number = COALESCE(EXCLUDED.phone_number, end_users.phone_number),
             department = EXCLUDED.department`,
          [migration_id, user.display_name, user.upn, user.phone_number, user.department]
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
    const {
      display_name,
      upn,
      phone_number,
      department,
      job_title,
      is_configured,
      notes,
    } = req.body;

    const users = await query<EndUser>(
      `UPDATE end_users SET
        display_name = COALESCE($1, display_name),
        upn = COALESCE($2, upn),
        phone_number = COALESCE($3, phone_number),
        department = COALESCE($4, department),
        job_title = COALESCE($5, job_title),
        is_configured = COALESCE($6, is_configured),
        configuration_date = CASE WHEN $6 = true THEN NOW() ELSE configuration_date END,
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *`,
      [display_name, upn, phone_number, department, job_title, is_configured, notes, id]
    );

    if (users.length === 0) {
      throw ApiError.notFound('User not found');
    }

    res.json(users[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM end_users WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('User not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
