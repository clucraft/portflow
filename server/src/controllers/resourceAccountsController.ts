import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { ResourceAccount } from '../types/index.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, type } = req.query;

    let sql = 'SELECT * FROM resource_accounts WHERE 1=1';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      sql += ` AND migration_id = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND account_type = $${params.length}`;
    }

    sql += ' ORDER BY display_name ASC';

    const resourceAccounts = await query<ResourceAccount>(sql, params);
    res.json(resourceAccounts);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const resourceAccounts = await query<ResourceAccount>(
      'SELECT * FROM resource_accounts WHERE id = $1',
      [id]
    );

    if (resourceAccounts.length === 0) {
      throw ApiError.notFound('Resource Account not found');
    }

    res.json(resourceAccounts[0]);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      migration_id,
      site_id,
      upn,
      display_name,
      account_type,
      notes,
    } = req.body;

    if (!migration_id || !site_id || !upn || !display_name || !account_type) {
      throw ApiError.badRequest('migration_id, site_id, upn, display_name, and account_type are required');
    }

    const resourceAccounts = await query<ResourceAccount>(
      `INSERT INTO resource_accounts (migration_id, site_id, upn, display_name, account_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [migration_id, site_id, upn, display_name, account_type, notes]
    );

    res.status(201).json(resourceAccounts[0]);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      upn,
      display_name,
      azure_ad_object_id,
      is_created_in_azure,
      is_licensed,
      license_type,
      notes,
    } = req.body;

    const resourceAccounts = await query<ResourceAccount>(
      `UPDATE resource_accounts SET
        upn = COALESCE($1, upn),
        display_name = COALESCE($2, display_name),
        azure_ad_object_id = COALESCE($3, azure_ad_object_id),
        is_created_in_azure = COALESCE($4, is_created_in_azure),
        is_licensed = COALESCE($5, is_licensed),
        license_type = COALESCE($6, license_type),
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *`,
      [upn, display_name, azure_ad_object_id, is_created_in_azure, is_licensed, license_type, notes, id]
    );

    if (resourceAccounts.length === 0) {
      throw ApiError.notFound('Resource Account not found');
    }

    res.json(resourceAccounts[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM resource_accounts WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Resource Account not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
