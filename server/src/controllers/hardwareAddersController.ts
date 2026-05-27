import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/audit.js';

interface HardwareAdder {
  id: string;
  name: string;
  unit_price: string | number;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// GET /api/settings/hardware-adders
export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<HardwareAdder>(
      `SELECT * FROM hardware_adders WHERE is_active = TRUE ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/settings/hardware-adders  (admin)
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, unit_price, sort_order } = req.body as { name?: string; unit_price?: number; sort_order?: number };
    if (!name || !name.trim()) {
      throw ApiError.badRequest('name is required');
    }
    const price = Number(unit_price);
    if (!Number.isFinite(price) || price < 0) {
      throw ApiError.badRequest('unit_price must be a non-negative number');
    }
    const rows = await query<HardwareAdder>(
      `INSERT INTO hardware_adders (name, unit_price, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), price, Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0]
    );
    logActivity(req.user?.id || null, 'settings.hardware_adder_created', `Created hardware adder "${rows[0].name}"`).catch(() => {});
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/settings/hardware-adders/:id  (admin)
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, unit_price, sort_order, is_active } = req.body as {
      name?: string;
      unit_price?: number;
      sort_order?: number;
      is_active?: boolean;
    };
    if (name !== undefined && !name.trim()) {
      throw ApiError.badRequest('name cannot be empty');
    }
    if (unit_price !== undefined) {
      const p = Number(unit_price);
      if (!Number.isFinite(p) || p < 0) {
        throw ApiError.badRequest('unit_price must be a non-negative number');
      }
    }
    const rows = await query<HardwareAdder>(
      `UPDATE hardware_adders SET
        name = COALESCE($1, name),
        unit_price = COALESCE($2, unit_price),
        sort_order = COALESCE($3, sort_order),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name?.trim(), unit_price, sort_order, is_active, id]
    );
    if (rows.length === 0) throw ApiError.notFound('hardware adder not found');
    logActivity(req.user?.id || null, 'settings.hardware_adder_updated', `Updated hardware adder "${rows[0].name}"`).catch(() => {});
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/settings/hardware-adders/:id  (admin)
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const rows = await query<HardwareAdder>(
      `DELETE FROM hardware_adders WHERE id = $1 RETURNING name`,
      [id]
    );
    if (rows.length === 0) throw ApiError.notFound('hardware adder not found');
    logActivity(req.user?.id || null, 'settings.hardware_adder_deleted', `Deleted hardware adder "${rows[0].name}"`).catch(() => {});
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
