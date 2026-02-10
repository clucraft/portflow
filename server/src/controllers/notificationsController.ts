import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';

interface Subscription {
  id: string;
  team_member_id: string;
  migration_id: string;
  created_at: Date;
}

// POST /api/migrations/:id/subscribe
export const subscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: migrationId } = req.params;
    const userId = req.user!.id;

    const result = await query<Subscription>(
      `INSERT INTO notification_subscriptions (team_member_id, migration_id)
       VALUES ($1, $2)
       ON CONFLICT (team_member_id, migration_id) DO NOTHING
       RETURNING *`,
      [userId, migrationId]
    );

    res.status(201).json({ subscribed: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/migrations/:id/subscribe
export const unsubscribe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: migrationId } = req.params;
    const userId = req.user!.id;

    await query(
      'DELETE FROM notification_subscriptions WHERE team_member_id = $1 AND migration_id = $2',
      [userId, migrationId]
    );

    res.json({ subscribed: false });
  } catch (err) {
    next(err);
  }
};

// GET /api/migrations/:id/subscribers
export const getSubscribers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: migrationId } = req.params;

    const subscribers = await query<{ team_member_id: string; display_name: string; email: string }>(
      `SELECT ns.team_member_id, tm.display_name, tm.email
       FROM notification_subscriptions ns
       JOIN team_members tm ON tm.id = ns.team_member_id
       WHERE ns.migration_id = $1`,
      [migrationId]
    );

    res.json(subscribers);
  } catch (err) {
    next(err);
  }
};

// GET /api/notifications/my-subscriptions
export const getMySubscriptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    const result = await query<{ migration_id: string }>(
      'SELECT migration_id FROM notification_subscriptions WHERE team_member_id = $1',
      [userId]
    );

    res.json(result.map((r) => r.migration_id));
  } catch (err) {
    next(err);
  }
};
