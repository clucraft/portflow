import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';

interface AuditEntry {
  id: string;
  team_member_id: string | null;
  action: string;
  details: string | null;
  migration_id: string | null;
  created_at: Date;
  actor_name: string | null;
  actor_email: string | null;
  migration_name: string | null;
}

// GET /api/settings/audit-log
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id, team_member_id, action, from, to, page, limit } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 25, 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (migration_id) {
      params.push(migration_id);
      whereClause += ` AND al.migration_id = $${params.length}`;
    }

    if (team_member_id) {
      params.push(team_member_id);
      whereClause += ` AND al.team_member_id = $${params.length}`;
    }

    if (action) {
      params.push(`%${action}%`);
      whereClause += ` AND al.action ILIKE $${params.length}`;
    }

    if (from) {
      params.push(from);
      whereClause += ` AND al.created_at >= $${params.length}::date`;
    }

    if (to) {
      params.push(to);
      whereClause += ` AND al.created_at <= ($${params.length}::date + interval '1 day')`;
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity_log al ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].count);

    // Get entries with JOINs
    params.push(limitNum, offset);
    const entries = await query<AuditEntry>(
      `SELECT
        al.id, al.team_member_id, al.action, al.details, al.migration_id, al.created_at,
        tm.display_name as actor_name, tm.email as actor_email,
        m.name as migration_name
      FROM activity_log al
      LEFT JOIN team_members tm ON tm.id = al.team_member_id
      LEFT JOIN migrations m ON m.id = al.migration_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ entries, total });
  } catch (err) {
    next(err);
  }
};
