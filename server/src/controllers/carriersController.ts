import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/audit.js';

interface Carrier {
  id: string;
  slug: string;
  display_name: string;
  monthly_charge: number;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// GET - list active carriers (for forms)
export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const carriers = await query<Carrier>(
      'SELECT * FROM carriers WHERE is_active = true ORDER BY sort_order ASC, display_name ASC'
    );
    res.json(carriers);
  } catch (err) {
    next(err);
  }
};

// GET - list all carriers (for admin)
export const listAll = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const carriers = await query<Carrier>(
      'SELECT * FROM carriers ORDER BY sort_order ASC, display_name ASC'
    );
    res.json(carriers);
  } catch (err) {
    next(err);
  }
};

// POST - create carrier
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, display_name, sort_order, monthly_charge } = req.body;

    if (!slug || !display_name) {
      throw ApiError.badRequest('slug and display_name are required');
    }

    const carriers = await query<Carrier>(
      `INSERT INTO carriers (slug, display_name, sort_order, monthly_charge)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [slug, display_name, sort_order || 0, monthly_charge || 0]
    );

    logActivity(req.user?.id || null, 'carrier.create', `Created carrier: ${carriers[0].display_name} (${carriers[0].slug})`).catch(() => {});

    res.status(201).json(carriers[0]);
  } catch (err) {
    next(err);
  }
};

// PUT - update carrier
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { display_name, is_active, sort_order, monthly_charge } = req.body;

    const carriers = await query<Carrier>(
      `UPDATE carriers SET
        display_name = COALESCE($1, display_name),
        is_active = COALESCE($2, is_active),
        sort_order = COALESCE($3, sort_order),
        monthly_charge = COALESCE($4, monthly_charge),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *`,
      [display_name, is_active, sort_order, monthly_charge, id]
    );

    if (carriers.length === 0) {
      throw ApiError.notFound('Carrier not found');
    }

    logActivity(req.user?.id || null, 'carrier.update', `Updated carrier: ${carriers[0].display_name}`).catch(() => {});

    res.json(carriers[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE - deactivate carrier
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE carriers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.length === 0) {
      throw ApiError.notFound('Carrier not found');
    }

    logActivity(req.user?.id || null, 'carrier.deactivate', `Deactivated carrier: ${id}`).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
