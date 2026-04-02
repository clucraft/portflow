import { Request, Response, NextFunction } from 'express';
import { query, getClient } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';

// Columns that are JSONB type and need JSON.stringify for restore
const JSONB_COLUMNS = new Set([
  'details', 'value', 'site_questionnaire', 'phase_tasks', 'cost_calculator',
  'menu_options', 'business_hours', 'agent_ids',
]);

// Tables in dependency order (parents before children)
const BACKUP_TABLES = [
  'team_members',
  'app_settings',
  'carriers',
  'voice_routing_policies',
  'dial_plans',
  'migrations',
  'end_users',
  'phone_numbers',
  'resource_accounts',
  'auto_attendants',
  'call_queues',
  'generated_scripts',
  'activity_log',
  'notification_subscriptions',
];

// POST /api/settings/backup - Generate and download a full database backup
export const createBackup = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tables: Record<string, unknown[]> = {};

    for (const table of BACKUP_TABLES) {
      try {
        const rows = await query(`SELECT * FROM ${table}`);
        tables[table] = rows;
      } catch {
        // Table may not exist yet (e.g. if migration hasn't been run)
        tables[table] = [];
      }
    }

    const backup = {
      version: '0.9.0',
      created_at: new Date().toISOString(),
      tables,
    };

    const json = JSON.stringify(backup, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="portflow-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(json);
  } catch (err) {
    next(err);
  }
};

// POST /api/settings/restore - Restore from a backup file
export const restoreBackup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = req.body;

    if (!backup || !backup.tables || typeof backup.tables !== 'object') {
      throw ApiError.badRequest('Invalid backup file format');
    }

    // Validate that it looks like a PortFlow backup
    if (!backup.version || !backup.created_at) {
      throw ApiError.badRequest('Invalid backup file: missing version or created_at');
    }

    const tables = backup.tables as Record<string, unknown[]>;
    const restoredTables: string[] = [];
    const skippedTables: string[] = [];

    // Use a single dedicated client so session settings (FK disable) persist
    const client = await getClient();

    try {
      // Disable FK constraints for the restore (on THIS connection)
      await client.query('SET session_replication_role = replica');

      // Truncate all known tables in a single statement
      try {
        await client.query(`TRUNCATE TABLE ${BACKUP_TABLES.join(', ')} CASCADE`);
      } catch {
        // Some tables may not exist — truncate individually as fallback
        for (const table of [...BACKUP_TABLES].reverse()) {
          try {
            await client.query(`TRUNCATE TABLE ${table} CASCADE`);
          } catch {
            // Table may not exist
          }
        }
      }

      // Insert data (forward dependency order)
      for (const table of BACKUP_TABLES) {
        const rows = tables[table];
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          skippedTables.push(table);
          continue;
        }

        try {
          // Get column names from first row
          const columns = Object.keys(rows[0] as Record<string, unknown>);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const columnList = columns.map(c => `"${c}"`).join(', ');
          const insertSql = `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`;

          for (const row of rows) {
            const record = row as Record<string, unknown>;
            const values = columns.map(col => {
              const val = record[col];
              if (val === null || val === undefined) return null;
              // JSONB columns need JSON.stringify regardless of JS type
              if (JSONB_COLUMNS.has(col)) {
                return JSON.stringify(val);
              }
              // Non-JSONB object values (shouldn't happen, but handle safely)
              if (typeof val === 'object') {
                return JSON.stringify(val);
              }
              return val;
            });
            await client.query(insertSql, values);
          }

          restoredTables.push(`${table} (${rows.length} rows)`);
        } catch (err) {
          restoredTables.push(`${table} (FAILED: ${(err as Error).message})`);
        }
      }

      // Re-enable FK constraints
      await client.query('SET session_replication_role = DEFAULT');
    } catch (err) {
      // Re-enable FK constraints on error
      try {
        await client.query('SET session_replication_role = DEFAULT');
      } catch {
        // ignore
      }
      throw err;
    } finally {
      // Always release the client back to the pool
      client.release();
    }

    res.json({
      success: true,
      message: 'Backup restored successfully',
      backup_date: backup.created_at,
      backup_version: backup.version,
      restored: restoredTables,
      skipped: skippedTables,
    });
  } catch (err) {
    next(err);
  }
};
