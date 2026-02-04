import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { TeamMember } from '../types/index.js';

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await query<TeamMember>(
      'SELECT * FROM team_members WHERE is_active = true ORDER BY display_name ASC'
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const members = await query<TeamMember>('SELECT * FROM team_members WHERE id = $1', [id]);

    if (members.length === 0) {
      throw ApiError.notFound('Team member not found');
    }

    res.json(members[0]);
  } catch (err) {
    next(err);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, display_name, role } = req.body;

    if (!email || !display_name) {
      throw ApiError.badRequest('email and display_name are required');
    }

    const members = await query<TeamMember>(
      `INSERT INTO team_members (email, display_name, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, display_name, role || 'member']
    );

    res.status(201).json(members[0]);
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { display_name, role, is_active } = req.body;

    const members = await query<TeamMember>(
      `UPDATE team_members SET
        display_name = COALESCE($1, display_name),
        role = COALESCE($2, role),
        is_active = COALESCE($3, is_active)
      WHERE id = $4
      RETURNING *`,
      [display_name, role, is_active, id]
    );

    if (members.length === 0) {
      throw ApiError.notFound('Team member not found');
    }

    res.json(members[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Soft delete by setting is_active = false
    const result = await query(
      'UPDATE team_members SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.length === 0) {
      throw ApiError.notFound('Team member not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
