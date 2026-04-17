import { query } from './db.js';
import { sendEmail } from './email.js';

interface Subscriber {
  email: string;
  display_name: string;
}

interface Assignee {
  email: string;
  display_name: string;
}

export const notifyAssignment = async (
  migrationId: string,
  migrationName: string,
  siteName: string | null,
  workflowStage: string,
  assigneeId: string,
  assignedByName?: string
): Promise<void> => {
  try {
    const rows = await query<Assignee>(
      'SELECT email, display_name FROM team_members WHERE id = $1 AND is_active = true',
      [assigneeId]
    );

    if (rows.length === 0) return;

    const assignee = rows[0];
    const link = `${process.env.APP_URL || ''}/migrations/${migrationId}`;
    const subject = `[PortFlow] You've been assigned to ${migrationName}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #06b6d4;">Migration Assignment</h2>
        <p>Hi ${assignee.display_name},</p>
        <p>You have been assigned to a PortFlow migration project.</p>
        <p><strong>Project:</strong> ${migrationName}</p>
        ${siteName ? `<p><strong>Site:</strong> ${siteName}</p>` : ''}
        <p><strong>Current stage:</strong> ${workflowStage.replace(/_/g, ' ')}</p>
        ${assignedByName ? `<p><strong>Assigned by:</strong> ${assignedByName}</p>` : ''}
        ${link ? `<p><a href="${link}" style="color: #06b6d4;">Open in PortFlow</a></p>` : ''}
        <hr style="border-color: #333;" />
        <p style="color: #666; font-size: 12px;">You are receiving this because you were assigned to this migration project.</p>
      </div>
    `;

    await sendEmail(assignee.email, subject, html);
  } catch (err) {
    console.error('Failed to send assignment notification:', err);
  }
};

export const notifySubscribers = async (
  migrationId: string,
  migrationName: string,
  event: string,
  details?: string,
  actor?: string
): Promise<void> => {
  try {
    const subscribers = await query<Subscriber>(
      `SELECT tm.email, tm.display_name
       FROM notification_subscriptions ns
       JOIN team_members tm ON tm.id = ns.team_member_id
       WHERE ns.migration_id = $1 AND tm.is_active = true`,
      [migrationId]
    );

    if (subscribers.length === 0) return;

    const subject = `[PortFlow] ${migrationName}: ${event}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #06b6d4;">PortFlow Notification</h2>
        <p><strong>Migration:</strong> ${migrationName}</p>
        <p><strong>Event:</strong> ${event}</p>
        ${actor ? `<p><strong>Completed by:</strong> ${actor}</p>` : ''}
        ${details ? `<p><strong>Details:</strong> ${details}</p>` : ''}
        <hr style="border-color: #333;" />
        <p style="color: #666; font-size: 12px;">You are receiving this because you subscribed to notifications for this migration.</p>
      </div>
    `;

    // Send emails in parallel (fire-and-forget per subscriber)
    await Promise.allSettled(
      subscribers.map((sub) => sendEmail(sub.email, subject, html))
    );
  } catch (err) {
    console.error('Failed to send notifications:', err);
  }
};
