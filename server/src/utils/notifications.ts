import { query } from './db.js';
import { sendEmail } from './email.js';

interface Subscriber {
  email: string;
  display_name: string;
}

export const notifySubscribers = async (
  migrationId: string,
  migrationName: string,
  event: string,
  details?: string
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
