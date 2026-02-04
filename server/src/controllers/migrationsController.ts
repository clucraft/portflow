import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { Migration, WorkflowStage, WORKFLOW_STAGES } from '../types/index.js';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage, carrier } = req.query;

    let sql = 'SELECT * FROM migrations WHERE workflow_stage != $1';
    const params: unknown[] = ['cancelled'];

    if (stage) {
      params.push(stage);
      sql += ` AND workflow_stage = $${params.length}`;
    }

    if (carrier) {
      params.push(carrier);
      sql += ` AND target_carrier = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const migrations = await query<Migration>(sql, params);
    res.json(migrations);
  } catch (err) {
    next(err);
  }
};

export const dashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const migrations = await query<Migration>('SELECT * FROM migration_dashboard ORDER BY created_at DESC');
    res.json(migrations);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const migrations = await query<Migration>('SELECT * FROM migrations WHERE id = $1', [id]);

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Get workflow stages metadata
export const getWorkflowStages = async (_req: Request, res: Response) => {
  res.json(WORKFLOW_STAGES);
};

// Create new migration (Phase 1: Estimate)
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      site_name,
      site_address,
      site_city,
      site_state,
      site_country,
      site_timezone,
      current_pbx_type,
      current_carrier,
      telephone_users,
      physical_phones_needed,
      monthly_calling_minutes,
      is_porting_numbers,
      new_numbers_requested,
      target_carrier,
      routing_type,
    } = req.body;

    if (!name || !site_name || !telephone_users) {
      throw ApiError.badRequest('name, site_name, and telephone_users are required');
    }

    const migrations = await query<Migration>(
      `INSERT INTO migrations (
        name, site_name, site_address, site_city, site_state, site_country, site_timezone,
        current_pbx_type, current_carrier, telephone_users, physical_phones_needed,
        monthly_calling_minutes, is_porting_numbers, new_numbers_requested,
        target_carrier, routing_type, workflow_stage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'estimate')
      RETURNING *`,
      [
        name, site_name, site_address, site_city, site_state,
        site_country || 'United States', site_timezone || 'America/New_York',
        current_pbx_type, current_carrier, telephone_users,
        physical_phones_needed || 0, monthly_calling_minutes,
        is_porting_numbers ?? true, new_numbers_requested || 0,
        target_carrier || 'verizon', routing_type || 'direct_routing',
      ]
    );

    res.status(201).json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Update estimate (Phase 1)
export const updateEstimate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      estimate_user_service_charge,
      estimate_equipment_charge,
      estimate_usage_charge,
      estimate_notes,
    } = req.body;

    // Calculate totals
    const total_monthly = (estimate_user_service_charge || 0) + (estimate_usage_charge || 0);
    const total_onetime = estimate_equipment_charge || 0;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        estimate_user_service_charge = $1,
        estimate_equipment_charge = $2,
        estimate_usage_charge = $3,
        estimate_total_monthly = $4,
        estimate_total_onetime = $5,
        estimate_notes = $6,
        estimate_created_at = COALESCE(estimate_created_at, NOW())
      WHERE id = $7
      RETURNING *`,
      [
        estimate_user_service_charge, estimate_equipment_charge, estimate_usage_charge,
        total_monthly, total_onetime, estimate_notes, id,
      ]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Accept estimate (move to Phase 2)
export const acceptEstimate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'estimate_accepted',
        estimate_accepted_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Update Verizon request info (Phase 2)
export const updateVerizonRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      billing_contact_name,
      billing_contact_email,
      billing_contact_phone,
      local_contact_name,
      local_contact_email,
      local_contact_phone,
      verizon_notes,
    } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        billing_contact_name = COALESCE($1, billing_contact_name),
        billing_contact_email = COALESCE($2, billing_contact_email),
        billing_contact_phone = COALESCE($3, billing_contact_phone),
        local_contact_name = COALESCE($4, local_contact_name),
        local_contact_email = COALESCE($5, local_contact_email),
        local_contact_phone = COALESCE($6, local_contact_phone),
        verizon_notes = COALESCE($7, verizon_notes)
      WHERE id = $8
      RETURNING *`,
      [
        billing_contact_name, billing_contact_email, billing_contact_phone,
        local_contact_name, local_contact_email, local_contact_phone,
        verizon_notes, id,
      ]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Submit Verizon request
export const submitVerizonRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { email_sent_to } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'verizon_submitted',
        verizon_request_submitted_at = NOW(),
        verizon_request_email_sent_to = $1
      WHERE id = $2
      RETURNING *`,
      [email_sent_to, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Mark Verizon setup complete
export const completeVerizonSetup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { verizon_site_id } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'verizon_complete',
        verizon_site_id = $1,
        verizon_setup_complete_at = NOW()
      WHERE id = $2
      RETURNING *`,
      [verizon_site_id, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Update porting info (Phase 3)
export const updatePortingInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      carrier_invoice_received,
      carrier_invoice_notes,
      carrier_account_number,
      carrier_pin,
      porting_notes,
    } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        carrier_invoice_received = COALESCE($1, carrier_invoice_received),
        carrier_invoice_notes = COALESCE($2, carrier_invoice_notes),
        carrier_account_number = COALESCE($3, carrier_account_number),
        carrier_pin = COALESCE($4, carrier_pin),
        porting_notes = COALESCE($5, porting_notes)
      WHERE id = $6
      RETURNING *`,
      [carrier_invoice_received, carrier_invoice_notes, carrier_account_number, carrier_pin, porting_notes, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Submit LOA
export const submitLoa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { loa_submitted_to } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'porting_submitted',
        loa_submitted_at = NOW(),
        loa_submitted_to = $1
      WHERE id = $2
      RETURNING *`,
      [loa_submitted_to, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Set FOC date
export const setFocDate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { foc_date, scheduled_port_date } = req.body;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'porting_scheduled',
        foc_date = $1,
        scheduled_port_date = $2
      WHERE id = $3
      RETURNING *`,
      [foc_date, scheduled_port_date, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Mark porting complete
export const completePorting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = 'porting_complete',
        actual_port_date = NOW()
      WHERE id = $1
      RETURNING *`,
      [id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    // Update all phone numbers to ported status
    await query(
      `UPDATE phone_numbers SET porting_status = 'ported', ported_date = NOW() WHERE migration_id = $1`,
      [id]
    );

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Generate magic link for customer data entry
export const generateMagicLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { expires_in_days } = req.body;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        magic_link_token = $1,
        magic_link_created_at = NOW(),
        magic_link_expires_at = $2
      WHERE id = $3
      RETURNING *`,
      [token, expiresAt, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json({
      ...migrations[0],
      magic_link_url: `/collect/${token}`,
    });
  } catch (err) {
    next(err);
  }
};

// Get migration by magic link token (public endpoint)
export const getByMagicLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;

    const migrations = await query<Migration>(
      `SELECT id, name, site_name, routing_type, magic_link_expires_at
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
      throw ApiError.badRequest('This link has expired');
    }

    // Update accessed timestamp
    await query(
      `UPDATE migrations SET magic_link_accessed_at = NOW() WHERE id = $1`,
      [migration.id]
    );

    res.json(migration);
  } catch (err) {
    next(err);
  }
};

// Update workflow stage manually
export const updateStage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const validStages: WorkflowStage[] = [
      'estimate', 'estimate_accepted', 'verizon_submitted', 'verizon_in_progress',
      'verizon_complete', 'porting_submitted', 'porting_scheduled', 'porting_complete',
      'user_config', 'completed', 'on_hold', 'cancelled',
    ];

    if (!validStages.includes(stage)) {
      throw ApiError.badRequest(`Invalid stage. Must be one of: ${validStages.join(', ')}`);
    }

    const updates: Record<string, unknown> = { workflow_stage: stage };

    if (stage === 'completed') {
      updates.completed_at = new Date();
    }

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = $1,
        completed_at = $2
      WHERE id = $3
      RETURNING *`,
      [stage, stage === 'completed' ? new Date() : null, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// General update
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Build dynamic update
    const allowedFields = [
      'name', 'site_name', 'site_address', 'site_city', 'site_state', 'site_country',
      'site_timezone', 'current_pbx_type', 'current_carrier', 'telephone_users',
      'physical_phones_needed', 'monthly_calling_minutes', 'is_porting_numbers',
      'new_numbers_requested', 'target_carrier', 'routing_type', 'notes',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    values.push(id);
    const migrations = await query<Migration>(
      `UPDATE migrations SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM migrations WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
