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

  // Convert plain-text body to HTML: escape HTML special chars, convert
  // newlines to <br>, preserve indentation with &nbsp;, and auto-linkify
  // URLs and emails. <br>/&nbsp; are used instead of CSS white-space:pre-wrap
  // because Outlook desktop ignores that CSS property.
  const bodyHtml = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;">${plainTextToHtml(body)}</div>`;

  return { subject, body, bodyHtml, to: loc.local_it_contact || '' };
}

/**
 * Convert a plain-text string to safe HTML with auto-linked URLs and emails.
 *
 * Outlook desktop ignores `white-space: pre-wrap` (it renders via Word, not a
 * real browser), so newlines are converted to explicit <br> tags to guarantee
 * line breaks survive in every client. Runs of spaces are converted to
 * non-breaking spaces so indentation is preserved too.
 */
function plainTextToHtml(text: string): string {
  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Linkify URLs. Match http:// or https:// followed by non-whitespace,
  // but trim common trailing punctuation that's almost certainly not part of the URL.
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
  html = html.replace(urlRegex, (match) => {
    // Strip trailing punctuation that's likely a sentence terminator, not URL syntax
    let trailing = '';
    while (match.length > 0 && /[.,;:!?)\]]/.test(match[match.length - 1])) {
      trailing = match[match.length - 1] + trailing;
      match = match.slice(0, -1);
    }
    return `<a href="${match}" style="color:#06b6d4;text-decoration:underline;" target="_blank" rel="noopener">${match}</a>${trailing}`;
  });

  // 3. Linkify bare email addresses (avoid double-linking ones already in an href)
  const emailRegex = /(?<!href=["']mailto:|["'>])\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b(?!["'])/g;
  html = html.replace(emailRegex, (_match, email) => {
    return `<a href="mailto:${email}" style="color:#06b6d4;text-decoration:underline;">${email}</a>`;
  });

  // 4. Preserve indentation: convert runs of 2+ spaces to non-breaking spaces.
  // Keep single spaces as regular spaces so the browser can wrap normally.
  html = html.replace(/  +/g, (match) => '&nbsp;'.repeat(match.length));

  // 5. Convert newlines to <br> so Outlook (which ignores white-space:pre-wrap)
  // still renders line breaks. Normalize CRLF first.
  html = html.replace(/\r\n?/g, '\n').replace(/\n/g, '<br>\n');

  return html;
}
