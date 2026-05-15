import { pool } from "./db.ts";
import { sendEmail } from "./email.ts";

type NotificationType =
  | "schedule_changes"
  | "team_messages"
  | "documents"
  | "rsvp_requests"
  | "payment_reminders"
  | "coach_messages";

interface NotificationOptions {
  type: NotificationType;
  subject: string;
  emailHtml: string;
  smsText: string;
  teamId?: number;
  familyId?: number;
}

export async function sendNotifications(options: NotificationOptions) {
  const { type, subject, emailHtml, smsText, teamId, familyId } = options;

  const emailField = `${type}_email`;
  const textField = `${type}_text`;

  let query = `
    SELECT np.user_id, np.notification_email, np.notification_phone,
           np.${emailField}, np.${textField}
    FROM notification_preferences np
    WHERE (np.${emailField} = true OR np.${textField} = true)
      AND (np.notification_email IS NOT NULL OR np.notification_phone IS NOT NULL)
  `;
  const bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (teamId) {
    query += ` AND np.user_id IN (
      SELECT DISTINCT ur.user_id FROM user_roles ur
      WHERE ur.role IN ('admin', 'coach', 'parent')
        AND (
          ur.role = 'admin'
          OR (ur.role = 'coach' AND ur.team_id = $${paramIndex++})
          OR (ur.role = 'parent' AND ur.family_id IN (
            SELECT DISTINCT p.family_id FROM players p
            JOIN team_players tp ON p.id = tp.player_id
            WHERE tp.team_id = $${paramIndex++}
          ))
        )
    )`;
    bindings.push(teamId, teamId);
  }

  if (familyId) {
    query += ` AND np.user_id IN (
      SELECT user_id FROM user_roles WHERE family_id = $${paramIndex++}
    )`;
    bindings.push(familyId);
  }

  const result = await pool.query(query, bindings);
  const prefs = result.rows;

  const summary = { emailsSent: 0, textsSent: 0, errors: [] as string[] };

  for (const pref of prefs) {
    if (pref[emailField] && pref.notification_email) {
      const emailResult = await sendEmail({ to: pref.notification_email, subject, html: emailHtml });
      if (emailResult.success) {
        summary.emailsSent++;
      } else {
        summary.errors.push(`Email to ${pref.notification_email}: ${emailResult.error}`);
      }
    }

    if (pref[textField] && pref.notification_phone) {
      if (!process.env.TWILIO_ACCOUNT_SID) {
        summary.errors.push(`SMS skipped — Twilio not configured`);
        continue;
      }
      try {
        await sendSMS(pref.notification_phone as string, smsText);
        await pool.query(
          `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, created_at)
           VALUES ($1, $2, 'sms', $3, 'success', NOW())`,
          [pref.user_id, type, pref.notification_phone]
        );
        summary.textsSent++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await pool.query(
          `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, error_message, created_at)
           VALUES ($1, $2, 'sms', $3, 'failed', $4, NOW())`,
          [pref.user_id, type, pref.notification_phone, msg]
        );
        summary.errors.push(`SMS to ${pref.notification_phone}: ${msg}`);
      }
    }
  }

  return summary;
}

async function sendSMS(to: string, message: string) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error("Twilio credentials not configured");
  }

  let formatted = to.replace(/\D/g, "");
  if (formatted.length === 10) formatted = `+1${formatted}`;
  else if (formatted.length === 11 && formatted.startsWith("1")) formatted = `+${formatted}`;
  else if (!formatted.startsWith("+")) formatted = `+${formatted}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: formatted,
      From: process.env.TWILIO_PHONE_NUMBER,
      Body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${error}`);
  }

  return response.json();
}

export async function sendTestSMS(to: string, message: string) {
  return sendSMS(to, message);
}
