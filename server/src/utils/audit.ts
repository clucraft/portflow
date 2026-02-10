import { query } from './db.js';

export const logActivity = async (
  teamMemberId: string | null,
  action: string,
  details?: string | null,
  migrationId?: string | null
): Promise<void> => {
  try {
    await query(
      `INSERT INTO activity_log (team_member_id, action, details, migration_id)
       VALUES ($1, $2, $3, $4)`,
      [teamMemberId || null, action, details || null, migrationId || null]
    );
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};
