import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { TeamMember } from '../types/index.js';
import { logActivity } from '../utils/audit.js';

const SAFE_FIELDS = 'id, email, display_name, role, is_active, last_login_at, created_at, updated_at';

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await query<TeamMember>(
      `SELECT ${SAFE_FIELDS} FROM team_members WHERE is_active = true ORDER BY display_name ASC`
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const members = await query<TeamMember>(
      `SELECT ${SAFE_FIELDS} FROM team_members WHERE id = $1`,
      [id]
    );

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
    const { email, display_name, role, password } = req.body;

    if (!email || !display_name) {
      throw ApiError.badRequest('email and display_name are required');
    }

    let password_hash = null;
    if (password) {
      if (password.length < 8) {
        throw ApiError.badRequest('Password must be at least 8 characters');
      }
      password_hash = await bcrypt.hash(password, 12);
    }

    const members = await query<TeamMember>(
      `INSERT INTO team_members (email, display_name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_FIELDS}`,
      [email.toLowerCase().trim(), display_name, role || 'member', password_hash]
    );

    logActivity(req.user?.id || null, 'team.create', `Created team member: ${members[0].display_name} (${members[0].role})`).catch(() => {});

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
      RETURNING ${SAFE_FIELDS}`,
      [display_name, role, is_active, id]
    );

    if (members.length === 0) {
      throw ApiError.notFound('Team member not found');
    }

    logActivity(req.user?.id || null, 'team.update', `Updated team member: ${members[0].display_name}`).catch(() => {});

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

    logActivity(req.user?.id || null, 'team.deactivate', `Deactivated team member: ${id}`).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// POST /api/team/:id/reset-password (admin only)
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters');
    }

    const hash = await bcrypt.hash(new_password, 12);
    const result = await query(
      `UPDATE team_members SET password_hash = $1 WHERE id = $2 RETURNING id`,
      [hash, id]
    );

    if (result.length === 0) {
      throw ApiError.notFound('Team member not found');
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
