import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { Migration, EndUser } from '../types/index.js';
import { validatePhoneNumber } from '../utils/phoneValidation.js';

const router = Router();

// GET /api/public/estimate/:token - Get estimate info for customer acceptance
router.get('/estimate/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const migrations = await query<Migration>(
      `SELECT id, name, site_name, site_city, site_state, telephone_users, physical_phones_needed,
              target_carrier, routing_type, estimate_user_service_charge, estimate_equipment_charge,
              estimate_usage_charge, estimate_total_monthly, estimate_total_onetime, estimate_notes,
              estimate_link_expires_at, estimate_accepted_at
       FROM migrations
       WHERE estimate_link_token = $1`,
      [token]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Invalid or expired link');
    }

    const migration = migrations[0];

    // Check expiration
    if (migration.estimate_link_expires_at && new Date(migration.estimate_link_expires_at) < new Date()) {
      throw ApiError.badRequest('This link has expired. Please contact your administrator for a new link.');
    }

    res.json({
      migration: {
        id: migration.id,
        name: migration.name,
        site_name: migration.site_name,
        site_city: migration.site_city,
        site_state: migration.site_state,
        telephone_users: migration.telephone_users,
        physical_phones_needed: migration.physical_phones_needed,
        target_carrier: migration.target_carrier,
        routing_type: migration.routing_type,
        estimate_user_service_charge: migration.estimate_user_service_charge,
        estimate_equipment_charge: migration.estimate_equipment_charge,
        estimate_usage_charge: migration.estimate_usage_charge,
        estimate_total_monthly: migration.estimate_total_monthly,
        estimate_total_onetime: migration.estimate_total_onetime,
        estimate_notes: migration.estimate_notes,
        estimate_accepted_at: migration.estimate_accepted_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/estimate/:token/accept - Accept the estimate
router.post('/estimate/:token/accept', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { accepted_by } = req.body;

    // Validate token and get migration
    const migrations = await query<Migration>(
      `SELECT id, estimate_link_expires_at, estimate_accepted_at FROM migrations WHERE estimate_link_token = $1`,
      [token]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Invalid or expired link');
    }

    const migration = migrations[0];

    if (migration.estimate_link_expires_at && new Date(migration.estimate_link_expires_at) < new Date()) {
      throw ApiError.badRequest('This link has expired');
    }

    if (migration.estimate_accepted_at) {
      throw ApiError.badRequest('This estimate has already been accepted');
    }

    // Accept the estimate and advance workflow
    await query(
      `UPDATE migrations SET
        workflow_stage = 'estimate_accepted',
        estimate_accepted_at = NOW(),
        estimate_accepted_by = $1
      WHERE id = $2`,
      [accepted_by || 'Customer (via link)', migration.id]
    );

    res.json({ success: true, message: 'Estimate accepted successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/collect/:token - Get migration info for customer data entry
router.get('/collect/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const migrations = await query<Migration>(
      `SELECT id, name, site_name, routing_type, country_code, magic_link_expires_at, user_data_collection_complete
       FROM migrations
       WHERE magic_link_token = $1`,
      [token]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Invalid or expired link');
    }

    const migration = migrations[0];

    // Check expiration
    if (migration.magic_link_expires_at && new Date(migration.magic_link_expires_at) < new Date()) {
      throw ApiError.badRequest('This link has expired. Please contact your administrator for a new link.');
    }

    // Update accessed timestamp
    await query(
      `UPDATE migrations SET magic_link_accessed_at = NOW() WHERE id = $1`,
      [migration.id]
    );

    // Get existing users for this migration
    const users = await query<EndUser>(
      `SELECT id, display_name, upn, phone_number, entered_via_magic_link, department FROM end_users WHERE migration_id = $1 ORDER BY display_name`,
      [migration.id]
    );

    res.json({
      migration: {
        id: migration.id,
        name: migration.name,
        site_name: migration.site_name,
        routing_type: migration.routing_type,
        country_code: migration.country_code,
        user_data_collection_complete: migration.user_data_collection_complete,
      },
      users,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/collect/:token/users - Submit user data via magic link
router.post('/collect/:token/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { users } = req.body;
    const submit = req.body.submit !== false; // default true for backward compat

    if (!Array.isArray(users)) {
      throw ApiError.badRequest('users array is required');
    }

    // Allow empty users array for draft saves, but require users for submit
    if (submit && users.length === 0) {
      throw ApiError.badRequest('users array is required');
    }

    // Validate token and get migration (including country_code and collection status)
    const migrations = await query<Migration>(
      `SELECT id, country_code, magic_link_expires_at, user_data_collection_complete FROM migrations WHERE magic_link_token = $1`,
      [token]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Invalid or expired link');
    }

    const migration = migrations[0];

    if (migration.magic_link_expires_at && new Date(migration.magic_link_expires_at) < new Date()) {
      throw ApiError.badRequest('This link has expired');
    }

    // Validate phone numbers first (for both draft and submit)
    const results = { success: 0, failed: 0, errors: [] as { row: number; error: string }[] };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      if (!user.display_name || !user.upn) {
        results.failed++;
        results.errors.push({ row: i + 1, error: 'display_name and upn are required' });
        continue;
      }

      // Validate phone number against migration's country code
      if (user.phone_number && migration.country_code) {
        const validation = validatePhoneNumber(user.phone_number, migration.country_code);
        if (!validation.isValid) {
          results.failed++;
          results.errors.push({ row: i + 1, error: validation.error || 'Invalid phone number format' });
          continue;
        }
      } else if (user.phone_number && !/^\+[1-9]\d{1,14}$/.test(user.phone_number)) {
        results.failed++;
        results.errors.push({ row: i + 1, error: 'Phone number must be in E.164 format (e.g., +12125551234)' });
        continue;
      }
    }

    // If there are validation errors, return early
    if (results.failed > 0) {
      res.json(results);
      return;
    }

    const isAppendMode = submit && migration.user_data_collection_complete;

    // Draft mode or Submit mode (collection not yet complete): delete all magic-link users first, then insert
    // This handles removals cleanly -- admin-added users (entered_via_magic_link = false) are preserved
    if (!isAppendMode) {
      await query(
        `DELETE FROM end_users WHERE migration_id = $1 AND entered_via_magic_link = true`,
        [migration.id]
      );
    }

    // Insert/upsert users
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      try {
        await query(
          `INSERT INTO end_users (migration_id, display_name, upn, phone_number, department, entered_via_magic_link)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (migration_id, upn) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             phone_number = COALESCE(EXCLUDED.phone_number, end_users.phone_number),
             department = COALESCE(EXCLUDED.department, end_users.department)`,
          [migration.id, user.display_name, user.upn, user.phone_number, user.department]
        );
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 1, error: (err as Error).message });
      }
    }

    // Mark user data collection as complete only on submit (not draft)
    if (submit && results.success > 0) {
      await query(
        `UPDATE migrations SET user_data_collection_complete = true WHERE id = $1`,
        [migration.id]
      );
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
