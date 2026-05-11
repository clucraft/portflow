import { Location } from '../types/index.js';

export interface KickoffTemplate {
  from_address?: string;
  from_name?: string;
  subject?: string;
  body?: string;       // plain text (line breaks preserved)
  enabled?: boolean;
}

export const DEFAULT_KICKOFF_SUBJECT =
  'Teams EV Migration Kick-off — {location_name} ({site_code})';

export const DEFAULT_KICKOFF_BODY = `Hi,

We're scheduling the kick-off for the Teams Enterprise Voice migration at your location ({location_name}, {country}).

  Planned kick-off date: {kickoff_with_it_date}
  Migration window:      {planned_start_date} to {planned_end_date}
  Assigned engineer:     {assigned_engineer}

The kick-off call will cover:
  - Project timeline and milestones
  - Network and infrastructure requirements
  - User device migration plan
  - Communication and support during cutover

Please reply with your availability so we can schedule.

Thanks,
{sender_display_name}`;

function fmt(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function renderKickoff(
  template: KickoffTemplate,
  loc: Location,
  senderDisplayName: string
): { subject: string; body: string; bodyHtml: string; to: string } {
  const placeholders: Record<string, string> = {
    site_code: loc.site_code || '',
    location_name: loc.location_name || '',
    region: loc.region || '',
    country: loc.country || '',
    company: loc.company || '',
    priority: loc.priority || '',
    complexity: loc.complexity || '',
    assigned_engineer: loc.assigned_engineer || '(not yet assigned)',
    local_it_contact: loc.local_it_contact || '',
    kickoff_with_it_date: fmt(loc.kickoff_with_it_date) || '(to be scheduled)',
    planned_start_date: fmt(loc.planned_start_date) || '(TBD)',
    planned_end_date: fmt(loc.planned_end_date) || '(TBD)',
    estimated_users: String(loc.estimated_users || 0),
    sender_display_name: senderDisplayName || '',
  };

  const substitute = (text: string): string =>
    text.replace(/\{(\w+)\}/g, (_match, key) => {
      return Object.prototype.hasOwnProperty.call(placeholders, key)
        ? placeholders[key]
        : `{${key}}`;
    });

  const subject = substitute(template.subject || DEFAULT_KICKOFF_SUBJECT);
  const body = substitute(template.body || DEFAULT_KICKOFF_BODY);

  // Convert plain-text body to HTML (preserve line breaks, escape HTML)
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bodyHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#222;white-space:pre-wrap;line-height:1.5;">${escapeHtml(body)}</div>`;

  return { subject, body, bodyHtml, to: loc.local_it_contact || '' };
}
