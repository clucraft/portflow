import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';

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

    // Disable FK constraints for the restore
    await query('SET session_replication_role = replica');

    try {
      // Truncate and restore in reverse dependency order for truncation,
      // then insert in forward dependency order
      const reverseTables = [...BACKUP_TABLES].reverse();

      // Truncate all tables (reverse order)
      for (const table of reverseTables) {
        if (tables[table] && Array.isArray(tables[table]) && tables[table].length > 0) {
          try {
            await query(`TRUNCATE TABLE ${table} CASCADE`);
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
              // Convert objects/arrays to JSON strings for JSONB columns
              if (val !== null && typeof val === 'object') {
                return JSON.stringify(val);
              }
              return val;
            });
            await query(insertSql, values);
          }

          restoredTables.push(`${table} (${rows.length} rows)`);
        } catch (err) {
          restoredTables.push(`${table} (FAILED: ${(err as Error).message})`);
        }
      }

      // Reset sequences for tables with serial/UUID columns
      // PostgreSQL UUID columns don't need sequence resets, but any SERIAL columns do
      try {
        await query(`
          SELECT setval(pg_get_serial_sequence(t.table_name, c.column_name),
                 COALESCE((SELECT MAX(CAST(c2.column_name AS bigint)) FROM information_schema.columns c2), 1), true)
          FROM information_schema.columns c
          JOIN information_schema.tables t ON t.table_name = c.table_name
          WHERE c.column_default LIKE 'nextval%'
            AND t.table_schema = 'public'
        `);
      } catch {
        // Not all tables have sequences, safe to ignore
      }
    } finally {
      // Re-enable FK constraints
      await query('SET session_replication_role = DEFAULT');
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
    // Make sure FK constraints are re-enabled even on error
    try {
      await query('SET session_replication_role = DEFAULT');
    } catch {
      // ignore
    }
    next(err);
  }
};
