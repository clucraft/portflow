import nodemailer from 'nodemailer';
import { query } from './db.js';

interface EmailConfig {
  host: string;
  port: number;
  from_address: string;
  enabled: boolean;
}

export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  try {
    const result = await query<{ value: EmailConfig }>(
      "SELECT value FROM app_settings WHERE key = 'email_relay'"
    );
    if (result.length === 0) return null;
    const config = result[0].value;
    if (!config.enabled || !config.host || !config.from_address) return null;
    return config;
  } catch {
    return null;
  }
};

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  options?: { from?: string; fromName?: string; bcc?: string[] }
): Promise<void> => {
  const config = await getEmailConfig();
  if (!config) return;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  // Custom from address overrides config.from_address; with friendly name if provided
  const fromAddr = options?.from || config.from_address;
  const from = options?.fromName ? `"${options.fromName}" <${fromAddr}>` : fromAddr;

  const bcc = options?.bcc?.filter((addr) => addr && /\S+@\S+\.\S+/.test(addr));

  await transport.sendMail({
    from,
    to,
    subject,
    html,
    ...(bcc && bcc.length > 0 ? { bcc } : {}),
  });
};

export const testEmailConfig = async (
  config: EmailConfig,
  testTo: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      tls: { rejectUnauthorized: false },
    });

    await transport.sendMail({
      from: config.from_address,
      to: testTo,
      subject: 'PortFlow Email Test',
      html: '<p>This is a test email from PortFlow. If you received this, email notifications are working correctly.</p>',
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
};
