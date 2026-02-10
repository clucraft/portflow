import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { TeamMember } from '../types/index.js';
import { AuthUser } from '../middleware/auth.js';
import { logActivity } from '../utils/audit.js';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

const getJwtExpiry = () => {
  return (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
};

const generateToken = (user: AuthUser): string => {
  return jwt.sign(
    { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
    getJwtSecret(),
    { expiresIn: getJwtExpiry() }
  );
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw ApiError.badRequest('Email and password are required');
    }

    const members = await query<TeamMember & { password_hash: string }>(
      'SELECT id, email, display_name, role, is_active, password_hash FROM team_members WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (members.length === 0) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const member = members[0];

    if (!member.is_active) {
      throw ApiError.unauthorized('Account is deactivated');
    }

    if (!member.password_hash) {
      throw ApiError.unauthorized('Password not set. Contact your administrator.');
    }

    const isValidPassword = await bcrypt.compare(password, member.password_hash);
    if (!isValidPassword) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Update last_login_at
    await query('UPDATE team_members SET last_login_at = NOW() WHERE id = $1', [member.id]);

    const user: AuthUser = {
      id: member.id,
      email: member.email,
      display_name: member.display_name,
      role: member.role,
    };

    const token = generateToken(user);

    logActivity(user.id, 'auth.login', `User logged in: ${user.email}`).catch(() => {});

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
export const me = async (req: Request, res: Response) => {
  res.json(req.user);
};

// POST /api/auth/change-password
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      throw ApiError.badRequest('Current password and new password are required');
    }

    if (new_password.length < 8) {
      throw ApiError.badRequest('New password must be at least 8 characters');
    }

    const members = await query<{ password_hash: string }>(
      'SELECT password_hash FROM team_members WHERE id = $1',
      [req.user!.id]
    );

    if (members.length === 0) {
      throw ApiError.notFound('User not found');
    }

    const isValid = await bcrypt.compare(current_password, members[0].password_hash);
    if (!isValid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE team_members SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);

    logActivity(req.user!.id, 'auth.change_password', 'User changed their password').catch(() => {});

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/setup — first-run only
export const setup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, display_name, password } = req.body;

    if (!email || !display_name || !password) {
      throw ApiError.badRequest('Email, display name, and password are required');
    }

    if (password.length < 8) {
      throw ApiError.badRequest('Password must be at least 8 characters');
    }

    // Check if any user already has a password (setup already done)
    const existing = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM team_members WHERE password_hash IS NOT NULL'
    );

    if (parseInt(existing[0].count) > 0) {
      throw ApiError.conflict('Setup has already been completed');
    }

    const hash = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await query<TeamMember>(
      'SELECT id FROM team_members WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    let member: TeamMember;
    if (existingUser.length > 0) {
      // Update existing user to admin with password
      const updated = await query<TeamMember>(
        `UPDATE team_members SET password_hash = $1, role = 'admin', display_name = $2, is_active = true
         WHERE email = $3 RETURNING id, email, display_name, role, is_active, last_login_at, created_at, updated_at`,
        [hash, display_name, email.toLowerCase().trim()]
      );
      member = updated[0];
    } else {
      // Create new admin user
      const created = await query<TeamMember>(
        `INSERT INTO team_members (email, display_name, role, password_hash)
         VALUES ($1, $2, 'admin', $3)
         RETURNING id, email, display_name, role, is_active, last_login_at, created_at, updated_at`,
        [email.toLowerCase().trim(), display_name, hash]
      );
      member = created[0];
    }

    const user: AuthUser = {
      id: member.id,
      email: member.email,
      display_name: member.display_name,
      role: member.role,
    };

    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/check-setup — check if setup has been completed
export const checkSetup = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM team_members WHERE password_hash IS NOT NULL'
    );
    res.json({ setup_complete: parseInt(result[0].count) > 0 });
  } catch (err) {
    next(err);
  }
};
