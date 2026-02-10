import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { testEmailConfig } from '../utils/email.js';
import { logActivity } from '../utils/audit.js';

interface AppSetting {
  key: string;
  value: unknown;
  updated_at: Date;
  updated_by: string | null;
}

// GET /api/settings
export const getAll = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await query<AppSetting>('SELECT * FROM app_settings ORDER BY key');
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

// GET /api/settings/:key
export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const settings = await query<AppSetting>('SELECT * FROM app_settings WHERE key = $1', [key]);

    if (settings.length === 0) {
      throw ApiError.notFound(`Setting "${key}" not found`);
    }

    res.json(settings[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/settings/:key (admin only)
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      throw ApiError.badRequest('value is required');
    }

    const settings = await query<AppSetting>(
      `INSERT INTO app_settings (key, value, updated_at, updated_by)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET
         value = $2,
         updated_at = NOW(),
         updated_by = $3
       RETURNING *`,
      [key, JSON.stringify(value), req.user?.id || null]
    );

    logActivity(req.user?.id || null, 'settings.update', `Updated setting: ${key}`).catch(() => {});

    res.json(settings[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/settings/email-relay/test (admin only)
export const testEmailRelay = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config, test_to } = req.body;

    if (!config || !test_to) {
      throw ApiError.badRequest('config and test_to are required');
    }

    const result = await testEmailConfig(config, test_to);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
