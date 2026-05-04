import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { Migration, WorkflowStage, WORKFLOW_STAGES } from '../types/index.js';
import { notifySubscribers, notifyAssignment } from '../utils/notifications.js';
import { logActivity } from '../utils/audit.js';
import { buildSharePointPayload } from '../utils/sharepoint.js';
import { deriveStatusFromMigrationStage } from './locationsController.js';

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

export const listQuestionnaires = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<Pick<Migration, 'id' | 'name' | 'site_name' | 'site_questionnaire'>>(
      `SELECT id, name, site_name, site_questionnaire FROM migrations
       WHERE site_questionnaire IS NOT NULL AND site_questionnaire != '{}'
       ORDER BY site_name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const migrations = await query<Migration>(
      `SELECT m.*, tm.display_name as created_by_name, tm2.display_name as assigned_to_name
       FROM migrations m
       LEFT JOIN team_members tm ON tm.id = m.created_by
       LEFT JOIN team_members tm2 ON tm2.id = m.assigned_to
       WHERE m.id = $1`,
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
      target_carrier,
      routing_type,
      voice_routing_policy,
      dial_plan,
      region,
      location_code,
      currency,
      assigned_to,
      notify_assignee,
    } = req.body;

    if (!name || !site_name) {
      throw ApiError.badRequest('name and site_name are required');
    }

    const migrations = await query<Migration>(
      `INSERT INTO migrations (
        name, site_name, site_address, site_city, site_state, site_country, site_timezone,
        target_carrier, routing_type, voice_routing_policy, dial_plan, region, location_code, currency, workflow_stage, created_by, assigned_to
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'estimate', $15, $16)
      RETURNING *`,
      [
        name, site_name, site_address, site_city, site_state,
        site_country || 'United States', site_timezone || 'America/New_York',
        target_carrier || 'verizon', routing_type || 'direct_routing',
        (routing_type || 'direct_routing') === 'direct_routing' ? (voice_routing_policy || null) : null,
        dial_plan || null,
        region || 'AMER',
        location_code || '',
        currency || 'USD',
        req.user?.id || null,
        assigned_to || null,
      ]
    );

    logActivity(req.user?.id || null, 'migration.create', `Created migration: ${migrations[0].name}`, migrations[0].id).catch(() => {});

    // Send assignment notification if requested and assignee is not the creator
    if (notify_assignee && assigned_to && assigned_to !== req.user?.id) {
      notifyAssignment(
        migrations[0].id,
        migrations[0].name,
        migrations[0].site_name,
        migrations[0].workflow_stage,
        assigned_to,
        req.user?.display_name
      ).catch(() => {});
    }

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
      estimate_carrier_charge,
      estimate_phone_equipment_charge,
      estimate_headset_equipment_charge,
      estimate_notes,
      cost_calculator,
    } = req.body;

    // Compute equipment total (phone + headset) for backward compat
    const phone = estimate_phone_equipment_charge || 0;
    const headset = estimate_headset_equipment_charge || 0;
    const equipment_total = phone + headset;
    // Use computed equipment total if sub-items provided, otherwise fall back to direct value
    const final_equipment = (estimate_phone_equipment_charge != null || estimate_headset_equipment_charge != null)
      ? equipment_total
      : (estimate_equipment_charge || 0);

    // Calculate totals: monthly = user_service + usage + carrier_charge
    const total_monthly = (estimate_user_service_charge || 0) + (estimate_usage_charge || 0) + (estimate_carrier_charge || 0);
    // One-time includes carrier activation fee from cost_calculator when present
    const activation_fee = (cost_calculator && typeof cost_calculator === 'object')
      ? (Number(cost_calculator.activation_fee) || 0) : 0;
    const total_onetime = final_equipment + activation_fee;

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        estimate_user_service_charge = $1,
        estimate_equipment_charge = $2,
        estimate_usage_charge = $3,
        estimate_carrier_charge = $4,
        estimate_phone_equipment_charge = $5,
        estimate_headset_equipment_charge = $6,
        estimate_total_monthly = $7,
        estimate_total_onetime = $8,
        estimate_notes = $9,
        cost_calculator = $10,
        estimate_created_at = COALESCE(estimate_created_at, NOW())
      WHERE id = $11
      RETURNING *`,
      [
        estimate_user_service_charge, final_equipment, estimate_usage_charge,
        estimate_carrier_charge, estimate_phone_equipment_charge, estimate_headset_equipment_charge,
        total_monthly, total_onetime, estimate_notes,
        cost_calculator ? JSON.stringify(cost_calculator) : null,
        id,
      ]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    const calcMethod = (cost_calculator && typeof cost_calculator === 'object')
      ? (cost_calculator as Record<string, unknown>).selected_method : null;
    const detail = `Monthly: ${total_monthly?.toFixed?.(2) || 0}, One-time: ${total_onetime?.toFixed?.(2) || 0}` +
      (calcMethod ? ` (Method ${calcMethod})` : '');
    logActivity(req.user?.id || null, 'migration.estimate_update', detail, id).catch(() => {});

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// Generate estimate acceptance link for customer
export const generateEstimateLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { expires_in_days } = req.body;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 14));

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        estimate_link_token = $1,
        estimate_link_created_at = NOW(),
        estimate_link_expires_at = $2
      WHERE id = $3
      RETURNING *`,
      [token, expiresAt, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    logActivity(req.user?.id || null, 'migration.estimate_link_generated', `Estimate link generated (expires ${expiresAt.toLocaleDateString()})`, id).catch(() => {});

    res.json({
      ...migrations[0],
      estimate_link_url: `/estimate/${token}`,
    });
  } catch (err) {
    next(err);
  }
};

// Accept estimate (move to Phase 2) - internal override
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

    notifySubscribers(id, migrations[0].name, 'Estimate Accepted', 'The cost estimate has been accepted.', req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.estimate_accepted', 'Estimate accepted (admin override)', id).catch(() => {});

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

    notifySubscribers(id, migrations[0].name, 'Carrier Request Submitted', `Request submitted to ${email_sent_to}`, req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.verizon_request_submitted', `Submitted to ${email_sent_to}`, id).catch(() => {});

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

    notifySubscribers(id, migrations[0].name, 'Carrier Setup Complete', 'Carrier site setup has been completed.', req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.verizon_setup_complete', verizon_site_id ? `Site ID: ${verizon_site_id}` : 'Carrier setup complete', id).catch(() => {});

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

    logActivity(req.user?.id || null, 'migration.loa_submitted', loa_submitted_to ? `LOA submitted to ${loa_submitted_to}` : 'LOA submitted', id).catch(() => {});

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

    logActivity(req.user?.id || null, 'migration.foc_set', `FOC: ${foc_date || 'unset'}, Port: ${scheduled_port_date || 'unset'}`, id).catch(() => {});

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

    notifySubscribers(id, migrations[0].name, 'Porting Complete', 'Number porting has been completed.', req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.porting_complete', 'All numbers ported', id).catch(() => {});

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

    logActivity(req.user?.id || null, 'migration.magic_link_generated', `User collection link generated (expires ${expiresAt.toLocaleDateString()})`, id).catch(() => {});

    res.json({
      ...migrations[0],
      magic_link_url: `/collect/${token}`,
    });
  } catch (err) {
    next(err);
  }
};

// Generate questionnaire link for customer
export const generateQuestionnaireLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { expires_in_days } = req.body;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expires_in_days || 30));

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        questionnaire_link_token = $1,
        questionnaire_link_created_at = NOW(),
        questionnaire_link_expires_at = $2
      WHERE id = $3
      RETURNING *`,
      [token, expiresAt, id]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    logActivity(req.user?.id || null, 'migration.questionnaire_link_generated', `Questionnaire link generated (expires ${expiresAt.toLocaleDateString()})`, id).catch(() => {});

    res.json({
      ...migrations[0],
      questionnaire_link_url: `/questionnaire/${token}`,
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

    const validStages = [
      'estimate', 'estimate_accepted', 'verizon_submitted', 'verizon_in_progress',
      'verizon_complete', 'porting_submitted', 'porting_scheduled', 'porting_complete',
      'user_config', 'completed', 'on_hold', 'cancelled', 'resume',
    ];

    if (!validStages.includes(stage)) {
      throw ApiError.badRequest(`Invalid stage. Must be one of: ${validStages.join(', ')}`);
    }

    // When putting on hold, require the on_hold_reason field
    const { on_hold_reason } = req.body;

    if (stage === 'on_hold') {
      // First get current stage to save it
      const current = await query<Migration>('SELECT workflow_stage FROM migrations WHERE id = $1', [id]);
      if (current.length === 0) throw ApiError.notFound('Migration not found');
      if (current[0].workflow_stage === 'on_hold') throw ApiError.badRequest('Migration is already on hold');
      if (current[0].workflow_stage === 'completed') throw ApiError.badRequest('Cannot put a completed migration on hold');

      const migrations = await query<Migration>(
        `UPDATE migrations SET
          workflow_stage = 'on_hold',
          on_hold_previous_stage = $1,
          on_hold_reason = $2,
          on_hold_at = NOW()
        WHERE id = $3
        RETURNING *`,
        [current[0].workflow_stage, on_hold_reason || null, id]
      );

      notifySubscribers(id, migrations[0].name, 'Put on hold', on_hold_reason || undefined, req.user?.display_name).catch(() => {});
      logActivity(req.user?.id || null, 'migration.on_hold', on_hold_reason || 'Put on hold', id).catch(() => {});

      res.json(migrations[0]);
      return;
    }

    // When resuming from on hold, use 'resume' as a special value
    let targetStage = stage;
    if (stage === 'resume') {
      const current = await query<Migration>('SELECT workflow_stage, on_hold_previous_stage FROM migrations WHERE id = $1', [id]);
      if (current.length === 0) throw ApiError.notFound('Migration not found');
      if (current[0].workflow_stage !== 'on_hold') throw ApiError.badRequest('Migration is not on hold');
      targetStage = (current[0].on_hold_previous_stage || 'estimate') as WorkflowStage;
    }

    if (stage === 'completed') {
      // completed_at is set below
    }

    // When reverting to estimate phase, clear acceptance so customer can re-accept
    const clearAcceptance = targetStage === 'estimate';
    const isResuming = stage === 'resume';

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = $1,
        completed_at = $2,
        estimate_accepted_at = CASE WHEN $4 THEN NULL ELSE estimate_accepted_at END,
        estimate_accepted_by = CASE WHEN $4 THEN NULL ELSE estimate_accepted_by END,
        on_hold_previous_stage = CASE WHEN $5 THEN NULL ELSE on_hold_previous_stage END,
        on_hold_reason = CASE WHEN $5 THEN NULL ELSE on_hold_reason END,
        on_hold_at = CASE WHEN $5 THEN NULL ELSE on_hold_at END
      WHERE id = $3
      RETURNING *`,
      [targetStage, targetStage === 'completed' ? new Date() : null, id, clearAcceptance, isResuming]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    const stageLabel = isResuming ? `Resumed from on hold (back to ${targetStage})` : `Stage changed to ${targetStage}`;
    notifySubscribers(id, migrations[0].name, stageLabel, undefined, req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.stage_change', stageLabel, id).catch(() => {});

    // Auto-sync linked location status when migration stage changes
    try {
      const linkedLoc = await query<{ id: string; status: string }>(
        'SELECT id, status FROM locations WHERE migration_id = $1',
        [id]
      );
      if (linkedLoc.length > 0) {
        const newStatus = deriveStatusFromMigrationStage(targetStage, linkedLoc[0].status);
        if (newStatus !== linkedLoc[0].status) {
          await query('UPDATE locations SET status = $1 WHERE id = $2', [newStatus, linkedLoc[0].id]);
        }
      }
    } catch {
      // Don't fail the stage change if location sync errors
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
      'new_numbers_requested', 'target_carrier', 'routing_type', 'voice_routing_policy', 'dial_plan', 'country_code', 'region', 'location_code', 'currency', 'notes', 'phase_tasks',
      'verizon_request_email_sent_to', 'verizon_site_id', 'foc_date', 'scheduled_port_date', 'actual_port_date',
      'site_questionnaire',
      'assigned_to',
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

    // Check if assignee is changing so we can optionally notify
    let previousAssignee: string | null = null;
    if (body.assigned_to !== undefined) {
      const existing = await query<{ assigned_to: string | null }>('SELECT assigned_to FROM migrations WHERE id = $1', [id]);
      previousAssignee = existing[0]?.assigned_to ?? null;
    }

    values.push(id);
    const migrations = await query<Migration>(
      `UPDATE migrations SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    // Send assignment notification if requested and assignee actually changed (and isn't the current user)
    const newAssignee = migrations[0].assigned_to;
    if (
      body.notify_assignee &&
      newAssignee &&
      newAssignee !== previousAssignee &&
      newAssignee !== req.user?.id
    ) {
      notifyAssignment(
        migrations[0].id,
        migrations[0].name,
        migrations[0].site_name,
        migrations[0].workflow_stage,
        newAssignee,
        req.user?.display_name
      ).catch(() => {});
    }

    // Audit log: list which fields changed (limit detail length)
    const changedFields = allowedFields.filter(f => body[f] !== undefined);
    if (changedFields.length > 0) {
      const detail = `Updated: ${changedFields.join(', ')}`.slice(0, 500);
      logActivity(req.user?.id || null, 'migration.update', detail, id).catch(() => {});
    }

    res.json(migrations[0]);
  } catch (err) {
    next(err);
  }
};

// GET /api/migrations/:id/history - Project-scoped audit log (any authed user)
export const getHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const entries = await query<{
      id: string;
      team_member_id: string | null;
      action: string;
      details: string | null;
      migration_id: string | null;
      created_at: Date;
      actor_name: string | null;
      actor_email: string | null;
    }>(
      `SELECT
        al.id, al.team_member_id, al.action, al.details, al.migration_id, al.created_at,
        tm.display_name as actor_name, tm.email as actor_email
      FROM activity_log al
      LEFT JOIN team_members tm ON tm.id = al.team_member_id
      WHERE al.migration_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2`,
      [id, limit]
    );

    res.json({ entries });
  } catch (err) {
    next(err);
  }
};

// Survey import: preview (check which survey_ids already exist)
export const importPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('rows must be a non-empty array');
    }

    const surveyIds = rows.map((r: Record<string, unknown>) => String(r.survey_id)).filter(Boolean);

    if (surveyIds.length === 0) {
      res.json({ existing_ids: [] });
      return;
    }

    // Build parameterised IN clause
    const placeholders = surveyIds.map((_, i) => `$${i + 1}`).join(', ');
    const existing = await query<{ survey_id: string }>(
      `SELECT survey_id FROM migrations WHERE survey_id IN (${placeholders})`,
      surveyIds
    );

    res.json({ existing_ids: existing.map(r => r.survey_id) });
  } catch (err) {
    next(err);
  }
};

// Survey import: create migrations from survey rows
export const importSurvey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('rows must be a non-empty array');
    }

    let created = 0;
    let skipped = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>;
      const surveyId = String(row.survey_id || '');

      try {
        // Skip if survey_id already exists
        if (surveyId) {
          const existing = await query<{ id: string }>(
            'SELECT id FROM migrations WHERE survey_id = $1',
            [surveyId]
          );
          if (existing.length > 0) {
            skipped++;
            continue;
          }
        }

        const companyName = String(row.company_name || '');
        const streetAddress = String(row.street_address || row.site_address || '');
        const city = String(row.city || '');
        const state = String(row.state || '');
        const country = String(row.country || '');
        const locationCode = String(row.location_code || '');

        // If no separate city field, try to parse from site_address
        let parsedCity = city;
        if (!parsedCity && streetAddress) {
          const parts = streetAddress.split(',').map((s: string) => s.trim());
          if (parts.length >= 3) {
            parsedCity = parts[parts.length - 1];
          } else if (parts.length === 2) {
            const zipCity = parts[1].trim();
            const match = zipCity.match(/^\d+\s+(.+)/);
            if (match) {
              parsedCity = match[1];
            } else {
              parsedCity = zipCity;
            }
          }
        }

        const migrationName = parsedCity ? `${companyName} - ${parsedCity}` : companyName;

        // Build site_questionnaire from all survey fields
        const questionnaire: Record<string, unknown> = {};
        const qFields: [string, string][] = [
          ['email', 'email'],
          ['name', 'name'],
          ['company_name', 'company_name'],
          ['legal_entity_code', 'legal_entity_code'],
          ['location_code', 'location_code'],
          ['street_address', 'street_address'],
          ['city', 'city'],
          ['state', 'state'],
          ['country', 'country'],
          ['site_address', 'site_address'],
          ['project_requestor', 'project_requestor'],
          ['head_of_location', 'head_of_location'],
          ['infrastructure_contact', 'infrastructure_contact'],
          ['service_desk', 'service_desk'],
          ['phone_system_manufacturer', 'phone_system_manufacturer'],
          ['phone_system_model', 'phone_system_model'],
          ['phone_system_age', 'phone_system_age'],
          ['phone_system_maintenance', 'phone_system_maintenance'],
          ['telephony_provider', 'telephony_provider'],
          ['provider_contract_term', 'provider_contract_term'],
          ['earliest_cancel_date', 'earliest_cancel_date'],
          ['connection_details', 'connection_details'],
          ['concurrent_channels', 'concurrent_channels'],
          ['main_subscriber_range', 'main_subscriber_range'],
          ['total_end_user_count', 'total_end_user_count'],
          ['personal_desk_phones', 'personal_desk_phones'],
          ['headset_percentage', 'headset_percentage'],
          ['default_headset', 'default_headset'],
          ['conference_room_devices', 'conference_room_devices'],
          ['cordless_dect_in_use', 'cordless_dect_in_use'],
          ['dect_details', 'dect_details'],
          ['dect_count', 'dect_count'],
          ['dect_smartphone_percentage', 'dect_smartphone_percentage'],
          ['mobile_standard_device', 'mobile_standard_device'],
          ['special_endpoints', 'special_endpoints'],
          ['special_endpoint_config', 'special_endpoint_config'],
          ['special_call_flow', 'special_call_flow'],
          ['internal_emergency_number', 'internal_emergency_number'],
          ['public_emergency_numbers', 'public_emergency_numbers'],
          ['infrastructure_operator', 'infrastructure_operator'],
          ['network_standard_planned', 'network_standard_planned'],
          ['network_project_timeline', 'network_project_timeline'],
          ['lan_subnets', 'lan_subnets'],
          ['client_access_port_speed', 'client_access_port_speed'],
          ['wlan_coverage', 'wlan_coverage'],
          ['redundant_wan', 'redundant_wan'],
          ['wan_bandwidth', 'wan_bandwidth'],
        ];

        for (const [rowKey, qKey] of qFields) {
          if (row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
            questionnaire[qKey] = row[rowKey];
          }
        }

        const totalUsers = row.total_end_user_count ? parseInt(String(row.total_end_user_count), 10) || 0 : 0;

        const migrations = await query<Migration>(
          `INSERT INTO migrations (
            name, survey_id, site_name, site_address, site_city, site_state, site_country,
            site_timezone, target_carrier, routing_type, currency, location_code, workflow_stage,
            telephone_users, site_questionnaire, created_by, assigned_to
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'estimate', $13, $14, $15, $16)
          RETURNING *`,
          [
            migrationName,
            surveyId || null,
            companyName,
            streetAddress || null,
            parsedCity || null,
            state || null,
            country || 'Germany',
            'Europe/Berlin',
            'verizon',
            'direct_routing',
            'EUR',
            locationCode || '',
            totalUsers,
            JSON.stringify(questionnaire),
            req.user?.id || null,
            req.user?.id || null,
          ]
        );

        if (migrations.length > 0) {
          created++;
        }
      } catch (rowErr) {
        errors.push({ row: i, error: (rowErr as Error).message });
      }
    }

    logActivity(
      req.user?.id || null,
      'migration.import',
      `Imported ${created} migrations from survey (${skipped} skipped, ${errors.length} errors)`
    ).catch(() => {});

    res.json({ created, skipped, errors });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get name before deleting
    const existing = await query<Migration>('SELECT name FROM migrations WHERE id = $1', [id]);
    const result = await query('DELETE FROM migrations WHERE id = $1 RETURNING id', [id]);

    if (result.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    logActivity(req.user?.id || null, 'migration.delete', `Deleted migration: ${existing[0]?.name || id}`).catch(() => {});

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};


// GET /api/migrations/:id/sharepoint-preview - Preview the SharePoint payload
export const sharepointPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const migrations = await query<Migration>("SELECT * FROM migrations WHERE id = $1", [id]);
    if (migrations.length === 0) throw ApiError.notFound("Migration not found");

    const settingRows = await query<{ value: { url?: string; enabled?: boolean } }>(
      "SELECT value FROM app_settings WHERE key = $1",
      ["sharepoint_webhook"]
    );
    const webhook = settingRows[0]?.value;
    const webhookConfigured = !!(webhook?.url && webhook?.enabled);

    res.json({
      payload: buildSharePointPayload(migrations[0]),
      webhook_configured: webhookConfigured,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/migrations/:id/sharepoint-send - Send the migration to the configured webhook
export const sharepointSend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const migrations = await query<Migration>("SELECT * FROM migrations WHERE id = $1", [id]);
    if (migrations.length === 0) throw ApiError.notFound("Migration not found");

    const settingRows = await query<{ value: { url?: string; enabled?: boolean } }>(
      "SELECT value FROM app_settings WHERE key = $1",
      ["sharepoint_webhook"]
    );
    const webhook = settingRows[0]?.value;
    if (!webhook?.url || !webhook?.enabled) {
      throw ApiError.badRequest("SharePoint webhook is not configured. Configure it in Settings > Integrations.");
    }

    const payload = buildSharePointPayload(migrations[0]);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw ApiError.badRequest(`Webhook returned ${response.status}: ${text.slice(0, 200)}`);
    }

    logActivity(
      req.user?.id || null,
      "migration.sharepoint_sent",
      `Sent to SharePoint list (${migrations[0].site_country || "Unknown country"})`,
      id
    ).catch(() => {});

    res.json({ success: true, payload });
  } catch (err) {
    next(err);
  }
};

