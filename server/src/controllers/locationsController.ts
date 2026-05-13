import { Request, Response, NextFunction } from 'express';
import { query } from '../utils/db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logActivity } from '../utils/audit.js';
import { Location } from '../types/index.js';
import { sendEmail } from '../utils/email.js';
import { renderKickoff, type KickoffTemplate } from '../utils/kickoffEmail.js';

const ALLOWED_FIELDS = [
  'site_code', 'location_name', 'region', 'country', 'company',
  'estimated_users', 'priority', 'complexity', 'complexity_reasons',
  'assigned_engineer', 'local_it_contact',
  'planned_start_date', 'planned_end_date',
  'verizon_request_submitted_date', 'setup_complete_date',
  'kickoff_with_it_date', 'kickoff_complete_date',
  'port_scheduling_submitted_date', 'port_complete_date',
  'hypercare_start_date', 'hypercare_end_date',
  'kickoff_email_sent_at', 'kickoff_email_sent_to',
  'notes', 'status', 'migration_id',
];

// Derive location status from a linked migration's workflow stage. Used to keep
// the location's status in sync with the migration when one is linked.
function deriveStatusFromMigrationStage(stage: string | null | undefined, currentStatus: string): string {
  if (!stage) return currentStatus;
  if (stage === 'completed') return 'completed';
  if (stage === 'on_hold') return 'on_hold';
  if (stage === 'cancelled') return 'cancelled';
  // Any active stage maps to in_progress
  if ([
    'estimate', 'estimate_accepted', 'verizon_submitted', 'verizon_in_progress',
    'verizon_complete', 'porting_submitted', 'porting_scheduled',
    'porting_complete', 'user_config',
  ].includes(stage)) {
    return 'in_progress';
  }
  return currentStatus;
}

// Lightweight country -> region mapping for default values
const COUNTRY_REGION: Record<string, string> = {
  'united states': 'AMER', 'usa': 'AMER', 'canada': 'AMER', 'mexico': 'AMER',
  'brazil': 'AMER', 'argentina': 'AMER', 'chile': 'AMER',
  'germany': 'EMEA', 'france': 'EMEA', 'italy': 'EMEA', 'spain': 'EMEA',
  'united kingdom': 'EMEA', 'uk': 'EMEA', 'switzerland': 'EMEA',
  'austria': 'EMEA', 'netherlands': 'EMEA', 'belgium': 'EMEA',
  'sweden': 'EMEA', 'norway': 'EMEA', 'denmark': 'EMEA', 'finland': 'EMEA',
  'poland': 'EMEA', 'czech republic': 'EMEA', 'czechia': 'EMEA',
  'russia': 'EMEA', 'turkey': 'EMEA', 'ireland': 'EMEA', 'portugal': 'EMEA',
  'south africa': 'EMEA', 'liechtenstein': 'EMEA', 'luxembourg': 'EMEA',
  'china': 'APAC', 'japan': 'APAC', 'south korea': 'APAC', 'india': 'APAC',
  'australia': 'APAC', 'new zealand': 'APAC', 'singapore': 'APAC',
  'thailand': 'APAC', 'malaysia': 'APAC', 'indonesia': 'APAC',
  'philippines': 'APAC', 'vietnam': 'APAC', 'taiwan': 'APAC', 'hong kong': 'APAC',
};

function deriveRegion(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_REGION[country.toLowerCase().trim()] || null;
}

interface LocationWithMigration extends Location {
  migration_name: string | null;
  migration_workflow_stage: string | null;
}

// GET /api/locations
export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query<LocationWithMigration>(
      `SELECT l.*,
        m.name as migration_name,
        m.workflow_stage as migration_workflow_stage
       FROM locations l
       LEFT JOIN migrations m ON m.id = l.migration_id
       ORDER BY l.site_code ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/locations/by-migration/:migration_id
export const getByMigration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { migration_id } = req.params;
    const rows = await query<Location>(
      'SELECT * FROM locations WHERE migration_id = $1 LIMIT 1',
      [migration_id]
    );
    if (rows.length === 0) {
      res.json(null);
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// GET /api/locations/:id
export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const rows = await query<LocationWithMigration>(
      `SELECT l.*,
        m.name as migration_name,
        m.workflow_stage as migration_workflow_stage
       FROM locations l
       LEFT JOIN migrations m ON m.id = l.migration_id
       WHERE l.id = $1`,
      [id]
    );
    if (rows.length === 0) throw ApiError.notFound('Location not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/locations
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    if (!body.site_code || !body.location_name) {
      throw ApiError.badRequest('site_code and location_name are required');
    }

    // Auto-derive region from country if not set
    if (!body.region && body.country) {
      body.region = deriveRegion(body.country);
    }

    const fields: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (const f of ALLOWED_FIELDS) {
      if (body[f] !== undefined) {
        fields.push(f);
        placeholders.push(`$${values.length + 1}`);
        values.push(body[f]);
      }
    }
    fields.push('created_by');
    placeholders.push(`$${values.length + 1}`);
    values.push(req.user?.id || null);

    const rows = await query<Location>(
      `INSERT INTO locations (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );

    logActivity(req.user?.id || null, 'location.create', `Created location ${rows[0].site_code} (${rows[0].location_name})`).catch(() => {});

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/locations/:id
export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const f of ALLOWED_FIELDS) {
      if (body[f] !== undefined) {
        values.push(body[f]);
        sets.push(`${f} = $${values.length}`);
      }
    }

    if (sets.length === 0) throw ApiError.badRequest('No fields to update');

    values.push(id);
    const rows = await query<Location>(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (rows.length === 0) throw ApiError.notFound('Location not found');

    // Log changed fields
    const changed = ALLOWED_FIELDS.filter(f => body[f] !== undefined);
    logActivity(req.user?.id || null, 'location.update', `Updated location ${rows[0].site_code}: ${changed.join(', ')}`).catch(() => {});

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/bulk-delete
export const bulkRemove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    // Get site codes for logging
    const existing = await query<{ id: string; site_code: string }>(
      `SELECT id, site_code FROM locations WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    const found = existing.length;
    if (found === 0) {
      res.json({ deleted: 0 });
      return;
    }

    await query(`DELETE FROM locations WHERE id = ANY($1::uuid[])`, [ids]);

    // Log per location for clean History trail
    for (const loc of existing) {
      logActivity(req.user?.id || null, 'location.delete', `Deleted location ${loc.site_code} (bulk)`).catch(() => {});
    }

    res.json({ deleted: found });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/locations/:id
export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await query<Location>('SELECT site_code FROM locations WHERE id = $1', [id]);
    if (existing.length === 0) throw ApiError.notFound('Location not found');

    await query('DELETE FROM locations WHERE id = $1', [id]);

    logActivity(req.user?.id || null, 'location.delete', `Deleted location ${existing[0].site_code}`).catch(() => {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/:id/link - Link to an existing migration project
export const linkMigration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { migration_id } = req.body;

    if (!migration_id) throw ApiError.badRequest('migration_id is required');

    // Get the migration to derive status
    const migrations = await query<{ workflow_stage: string; name: string }>(
      'SELECT workflow_stage, name FROM migrations WHERE id = $1',
      [migration_id]
    );
    if (migrations.length === 0) throw ApiError.badRequest('Migration not found');

    const existing = await query<Location>('SELECT * FROM locations WHERE id = $1', [id]);
    if (existing.length === 0) throw ApiError.notFound('Location not found');

    const newStatus = deriveStatusFromMigrationStage(migrations[0].workflow_stage, existing[0].status);

    const rows = await query<Location>(
      `UPDATE locations SET migration_id = $1, status = $2 WHERE id = $3 RETURNING *`,
      [migration_id, newStatus, id]
    );

    logActivity(req.user?.id || null, 'location.link', `Linked location ${rows[0].site_code} to project ${migrations[0].name}`, migration_id).catch(() => {});

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/:id/unlink
export const unlinkMigration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const rows = await query<Location>(
      `UPDATE locations SET migration_id = NULL WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) throw ApiError.notFound('Location not found');

    logActivity(req.user?.id || null, 'location.unlink', `Unlinked location ${rows[0].site_code} from its project`).catch(() => {});
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/import/preview - Show what will be imported/linked
export const importPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) throw ApiError.badRequest('rows must be an array');

    // Fetch existing locations and migrations once
    const existingLocs = await query<Pick<Location, 'site_code'>>('SELECT site_code FROM locations');
    const existingSiteCodes = new Set(existingLocs.map(l => l.site_code.toLowerCase()));

    const migrations = await query<{ id: string; name: string; site_city: string | null; site_country: string | null; workflow_stage: string }>(
      'SELECT id, name, site_city, site_country, workflow_stage FROM migrations'
    );
    // Match by name (uppercase exact) — user has been using site code as project name
    const byName = new Map(migrations.map(m => [m.name.toUpperCase().trim(), m]));

    const result = {
      to_create: [] as Array<{ site_code: string; location_name: string; matched_migration: { id: string; name: string; workflow_stage: string } | null }>,
      already_exists: [] as Array<{ site_code: string; location_name: string }>,
    };

    for (const row of rows) {
      const siteCode = String(row.site_code || '').trim();
      if (!siteCode) continue;

      const locationName = String(row.location_name || '').trim();

      if (existingSiteCodes.has(siteCode.toLowerCase())) {
        result.already_exists.push({ site_code: siteCode, location_name: locationName });
        continue;
      }

      // Try to match a migration by name
      const matched = byName.get(siteCode.toUpperCase()) || null;

      result.to_create.push({
        site_code: siteCode,
        location_name: locationName,
        matched_migration: matched ? { id: matched.id, name: matched.name, workflow_stage: matched.workflow_stage } : null,
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/import - Bulk import locations
export const importLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, auto_link_overrides } = req.body;
    // auto_link_overrides: { [site_code]: false } to skip linking for specific rows
    if (!Array.isArray(rows)) throw ApiError.badRequest('rows must be an array');

    const skipLink = new Set(
      Object.entries(auto_link_overrides || {})
        .filter(([, v]) => v === false)
        .map(([k]) => k.toLowerCase())
    );

    const migrations = await query<{ id: string; name: string; workflow_stage: string }>(
      'SELECT id, name, workflow_stage FROM migrations'
    );
    const byName = new Map(migrations.map(m => [m.name.toUpperCase().trim(), m]));

    const existingLocs = await query<{ site_code: string }>('SELECT site_code FROM locations');
    const existingSet = new Set(existingLocs.map(l => l.site_code.toLowerCase()));

    let created = 0;
    let linked = 0;
    let skipped = 0;
    const errors: { site_code: string; error: string }[] = [];

    for (const row of rows) {
      const siteCode = String(row.site_code || '').trim();
      if (!siteCode) {
        skipped++;
        continue;
      }
      if (existingSet.has(siteCode.toLowerCase())) {
        skipped++;
        continue;
      }

      try {
        const matched = byName.get(siteCode.toUpperCase()) || null;
        const shouldLink = matched && !skipLink.has(siteCode.toLowerCase());

        const region = row.region || deriveRegion(row.country);
        let status = String(row.status || 'planned').toLowerCase().replace(/\s+/g, '_');
        if (!['planned', 'in_progress', 'completed', 'on_hold', 'cancelled', 'out_of_scope'].includes(status)) {
          status = 'planned';
        }
        // If linking, override status from migration stage
        if (shouldLink && matched) {
          status = deriveStatusFromMigrationStage(matched.workflow_stage, status);
        }

        await query(
          `INSERT INTO locations (
            site_code, location_name, region, country, company,
            estimated_users, priority, complexity, complexity_reasons,
            assigned_engineer, local_it_contact,
            planned_start_date, planned_end_date,
            verizon_request_submitted_date, setup_complete_date,
            kickoff_with_it_date, kickoff_complete_date,
            port_scheduling_submitted_date, port_complete_date,
            hypercare_start_date, hypercare_end_date,
            notes, status, migration_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11,
            $12, $13,
            $14, $15,
            $16, $17,
            $18, $19,
            $20, $21,
            $22, $23, $24, $25
          )`,
          [
            siteCode,
            String(row.location_name || siteCode),
            region || null,
            row.country || null,
            row.company || null,
            Number(row.estimated_users) || 0,
            row.priority || null,
            row.complexity || null,
            row.complexity_reasons || null,
            row.assigned_engineer || null,
            row.local_it_contact || null,
            row.planned_start_date || null,
            row.planned_end_date || null,
            row.verizon_request_submitted_date || null,
            row.setup_complete_date || null,
            row.kickoff_with_it_date || null,
            row.kickoff_complete_date || null,
            row.port_scheduling_submitted_date || null,
            row.port_complete_date || null,
            row.hypercare_start_date || null,
            row.hypercare_end_date || null,
            row.notes || null,
            status,
            shouldLink && matched ? matched.id : null,
            req.user?.id || null,
          ]
        );

        created++;
        if (shouldLink) linked++;
      } catch (rowErr) {
        errors.push({ site_code: siteCode, error: (rowErr as Error).message });
      }
    }

    logActivity(
      req.user?.id || null,
      'location.import',
      `Imported ${created} locations (${linked} auto-linked, ${skipped} skipped, ${errors.length} errors)`
    ).catch(() => {});

    res.json({ created, linked, skipped, errors });
  } catch (err) {
    next(err);
  }
};

async function getKickoffTemplate(): Promise<KickoffTemplate> {
  try {
    const rows = await query<{ value: KickoffTemplate }>(
      "SELECT value FROM app_settings WHERE key = 'kickoff_email_template'"
    );
    return rows[0]?.value || {};
  } catch {
    return {};
  }
}

// POST /api/locations/kickoff/preview - Render kickoff emails for selected locations
export const kickoffPreview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, subject_override, body_override, from_address_override, from_name_override } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    const locs = await query<Location>(
      `SELECT * FROM locations WHERE id = ANY($1::uuid[])`, [ids]
    );

    const template = await getKickoffTemplate();
    const effectiveTemplate: KickoffTemplate = {
      ...template,
      subject: subject_override ?? template.subject,
      body: body_override ?? template.body,
      from_address: from_address_override ?? template.from_address,
      from_name: from_name_override ?? template.from_name,
    };
    const senderName = req.user?.display_name || '';

    const rendered = locs.map(loc => {
      const r = renderKickoff(effectiveTemplate, loc, senderName);
      return {
        id: loc.id,
        site_code: loc.site_code,
        location_name: loc.location_name,
        to: r.to,
        subject: r.subject,
        body: r.body,
        body_html: r.bodyHtml,
        valid: !!r.to && /\S+@\S+\.\S+/.test(r.to),
        previously_sent_at: loc.kickoff_email_sent_at,
        previously_sent_to: loc.kickoff_email_sent_to,
      };
    });

    res.json({
      from_address: effectiveTemplate.from_address || null,
      from_name: effectiveTemplate.from_name || null,
      emails: rendered,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/kickoff/send - Actually send kickoff emails
export const kickoffSend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, subject_override, body_override, from_address_override, from_name_override, bcc } = req.body as {
      ids?: string[];
      subject_override?: string;
      body_override?: string;
      from_address_override?: string;
      from_name_override?: string;
      bcc?: string[];
    };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    // Sanitize BCC: keep only well-formed addresses, dedupe, cap to a reasonable size
    const bccList = Array.isArray(bcc)
      ? Array.from(new Set(bcc.filter((a) => typeof a === 'string' && /\S+@\S+\.\S+/.test(a)))).slice(0, 10)
      : [];

    const locs = await query<Location>(
      `SELECT * FROM locations WHERE id = ANY($1::uuid[])`, [ids]
    );

    const template = await getKickoffTemplate();
    const effectiveTemplate: KickoffTemplate = {
      ...template,
      subject: subject_override ?? template.subject,
      body: body_override ?? template.body,
      from_address: from_address_override ?? template.from_address,
      from_name: from_name_override ?? template.from_name,
    };
    const senderName = req.user?.display_name || '';

    let sent = 0;
    let skipped = 0;
    const errors: { site_code: string; error: string }[] = [];

    for (const loc of locs) {
      const r = renderKickoff(effectiveTemplate, loc, senderName);
      if (!r.to || !/\S+@\S+\.\S+/.test(r.to)) {
        skipped++;
        continue;
      }
      try {
        await sendEmail(r.to, r.subject, r.bodyHtml, {
          from: effectiveTemplate.from_address || undefined,
          fromName: effectiveTemplate.from_name || senderName || undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
        });
        sent++;
        // Record the timestamp + recipient on the location
        await query(
          `UPDATE locations SET kickoff_email_sent_at = NOW(), kickoff_email_sent_to = $1 WHERE id = $2`,
          [r.to, loc.id]
        ).catch(() => {});
        const bccSuffix = bccList.length > 0 ? ` (bcc: ${bccList.join(', ')})` : '';
        logActivity(
          req.user?.id || null,
          'location.kickoff_email_sent',
          `Sent kick-off email to ${r.to} (${loc.site_code})${bccSuffix}`
        ).catch(() => {});
      } catch (err) {
        errors.push({ site_code: loc.site_code, error: (err as Error).message });
      }
    }

    res.json({ sent, skipped, errors });
  } catch (err) {
    next(err);
  }
};

// POST /api/locations/bulk-mark-kickoff-sent - Mark locations as kickoff-sent
// without actually sending email (for backfilling existing manual outreach)
export const bulkMarkKickoffSent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, sent_at } = req.body as { ids?: string[]; sent_at?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    // Validate the date if provided, default to now
    let timestamp: Date;
    if (sent_at) {
      const d = new Date(sent_at);
      if (isNaN(d.getTime())) throw ApiError.badRequest('Invalid sent_at date');
      timestamp = d;
    } else {
      timestamp = new Date();
    }

    // Set kickoff_email_sent_at on every selected location, and capture the
    // current local_it_contact as the recipient (for reference)
    const locs = await query<Location>(
      `SELECT id, site_code, local_it_contact FROM locations WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    let updated = 0;
    for (const loc of locs) {
      await query(
        `UPDATE locations
         SET kickoff_email_sent_at = $1,
             kickoff_email_sent_to = $2
         WHERE id = $3`,
        [timestamp, loc.local_it_contact || null, loc.id]
      );
      updated++;
      logActivity(
        req.user?.id || null,
        'location.kickoff_email_marked_sent',
        `Manually marked kick-off sent (${loc.site_code}${loc.local_it_contact ? ` to ${loc.local_it_contact}` : ''})`
      ).catch(() => {});
    }

    res.json({ updated });
  } catch (err) {
    next(err);
  }
};

// Export the deriveStatusFromMigrationStage helper for the migrations controller
// to call when stage transitions happen on a linked migration.
export { deriveStatusFromMigrationStage };
