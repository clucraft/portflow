import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { Migration, WorkflowStage, WORKFLOW_STAGES } from '../types/index.js';
import { notifySubscribers } from '../utils/notifications.js';
import { logActivity } from '../utils/audit.js';

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
      target_carrier,
      routing_type,
      voice_routing_policy,
      dial_plan,
      currency,
    } = req.body;

    if (!name || !site_name) {
      throw ApiError.badRequest('name and site_name are required');
    }

    const migrations = await query<Migration>(
      `INSERT INTO migrations (
        name, site_name, site_address, site_city, site_state, site_country, site_timezone,
        target_carrier, routing_type, voice_routing_policy, dial_plan, currency, workflow_stage, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'estimate', $13)
      RETURNING *`,
      [
        name, site_name, site_address, site_city, site_state,
        site_country || 'United States', site_timezone || 'America/New_York',
        target_carrier || 'verizon', routing_type || 'direct_routing',
        (routing_type || 'direct_routing') === 'direct_routing' ? (voice_routing_policy || null) : null,
        dial_plan || null,
        currency || 'USD',
        req.user?.id || null,
      ]
    );

    logActivity(req.user?.id || null, 'migration.create', `Created migration: ${migrations[0].name}`, migrations[0].id).catch(() => {});

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
    const total_onetime = final_equipment;

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
        estimate_created_at = COALESCE(estimate_created_at, NOW())
      WHERE id = $10
      RETURNING *`,
      [
        estimate_user_service_charge, final_equipment, estimate_usage_charge,
        estimate_carrier_charge, estimate_phone_equipment_charge, estimate_headset_equipment_charge,
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

    notifySubscribers(id, migrations[0].name, 'Porting Complete', 'Number porting has been completed.', req.user?.display_name).catch(() => {});

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

    // When reverting to estimate phase, clear acceptance so customer can re-accept
    const clearAcceptance = stage === 'estimate';

    const migrations = await query<Migration>(
      `UPDATE migrations SET
        workflow_stage = $1,
        completed_at = $2,
        estimate_accepted_at = CASE WHEN $4 THEN NULL ELSE estimate_accepted_at END,
        estimate_accepted_by = CASE WHEN $4 THEN NULL ELSE estimate_accepted_by END
      WHERE id = $3
      RETURNING *`,
      [stage, stage === 'completed' ? new Date() : null, id, clearAcceptance]
    );

    if (migrations.length === 0) {
      throw ApiError.notFound('Migration not found');
    }

    notifySubscribers(id, migrations[0].name, `Stage changed to ${stage}`, undefined, req.user?.display_name).catch(() => {});
    logActivity(req.user?.id || null, 'migration.stage_change', `Stage changed to ${stage}`, id).catch(() => {});

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
      'new_numbers_requested', 'target_carrier', 'routing_type', 'voice_routing_policy', 'dial_plan', 'country_code', 'currency', 'notes', 'phase_tasks',
      'verizon_request_email_sent_to', 'verizon_site_id', 'foc_date', 'scheduled_port_date', 'actual_port_date',
      'site_questionnaire',
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
        const siteAddress = String(row.site_address || '');

        // Best-effort parse city from address "Street, ZIP City" or "Street, ZIP, City"
        let city = '';
        let state = '';
        if (siteAddress) {
          const parts = siteAddress.split(',').map((s: string) => s.trim());
          if (parts.length >= 3) {
            // Format: "Street, ZIP, City" — take last part as city
            city = parts[parts.length - 1];
          } else if (parts.length === 2) {
            // Format: "Street, ZIP City" — extract city from "ZIP City"
            const zipCity = parts[1].trim();
            const match = zipCity.match(/^\d+\s+(.+)/);
            if (match) {
              city = match[1];
            } else {
              city = zipCity;
            }
          }
        }

        const migrationName = city ? `${companyName} - ${city}` : companyName;

        // Build site_questionnaire from all survey fields
        const questionnaire: Record<string, unknown> = {};
        const qFields: [string, string][] = [
          ['email', 'email'],
          ['name', 'name'],
          ['company_name', 'company_name'],
          ['legal_entity_code', 'legal_entity_code'],
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
            site_timezone, target_carrier, routing_type, currency, workflow_stage,
            telephone_users, site_questionnaire, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'estimate', $12, $13, $14)
          RETURNING *`,
          [
            migrationName,
            surveyId || null,
            companyName,
            siteAddress || null,
            city || null,
            state || null,
            'Germany',
            'Europe/Berlin',
            'verizon',
            'direct_routing',
            'EUR',
            totalUsers,
            JSON.stringify(questionnaire),
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
