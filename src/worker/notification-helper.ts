import type { Env } from "@/shared/types";

interface NotificationOptions {
  env: Env;
  type: 'schedule_changes' | 'team_messages' | 'documents' | 'rsvp_requests' | 'payment_reminders' | 'coach_messages';
  subject: string;
  emailHtml: string;
  smsText: string;
  teamId?: number;
  familyId?: number;
}

export async function sendNotifications(options: NotificationOptions) {
  const { env, type, subject, emailHtml, smsText, teamId, familyId } = options;
  
  // Determine which preference fields to check based on notification type
  const emailField = `${type}_email`;
  const textField = `${type}_text`;
  
  // Build query to get notification preferences
  let query = `
    SELECT np.user_id, np.notification_email, np.notification_phone,
           np.${emailField}, np.${textField}
    FROM notification_preferences np
    WHERE (np.${emailField} = 1 OR np.${textField} = 1)
      AND (np.notification_email IS NOT NULL OR np.notification_phone IS NOT NULL)
  `;
  
  const bindings: any[] = [];
  
  // Filter by team if specified
  if (teamId) {
    query += ` AND np.user_id IN (
      SELECT DISTINCT ur.user_id FROM user_roles ur
      WHERE ur.role IN ('Admin', 'Coach', 'Family')
        AND (
          ur.role = 'Admin'
          OR (ur.role = 'Coach' AND ur.team_id = ?)
          OR (ur.role = 'Family' AND ur.family_id IN (
            SELECT DISTINCT p.family_id FROM players p
            JOIN team_players tp ON p.id = tp.player_id
            WHERE tp.team_id = ?
          ))
        )
    )`;
    bindings.push(teamId, teamId);
  }
  
  // Filter by family if specified
  if (familyId) {
    query += ` AND np.user_id IN (
      SELECT user_id FROM user_roles WHERE family_id = ?
    )`;
    bindings.push(familyId);
  }
  
  const prefs = bindings.length > 0
    ? await env.DB.prepare(query).bind(...bindings).all()
    : await env.DB.prepare(query).all();

  const results = {
    emailsSent: 0,
    textsSent: 0,
    errors: [] as string[],
  };

  for (const pref of prefs.results || []) {
    // Send email if opted in
    if (pref[emailField] && pref.notification_email) {
      try {
        await env.EMAILS.send({
          to: pref.notification_email as string,
          subject,
          html_body: emailHtml,
        });
        results.emailsSent++;
      } catch (error) {
        console.error('Failed to send email notification:', error);
        results.errors.push(`Email to ${pref.notification_email}: ${error}`);
      }
    }
    
    // Send SMS if opted in and Twilio is configured
    if (pref[textField] && pref.notification_phone && env.TWILIO_ACCOUNT_SID) {
      console.log('[SMS] Attempting to send SMS to:', pref.notification_phone);
      console.log('[SMS] Twilio SID configured:', !!env.TWILIO_ACCOUNT_SID);
      console.log('[SMS] Twilio Auth configured:', !!env.TWILIO_AUTH_TOKEN);
      console.log('[SMS] Twilio Phone configured:', !!env.TWILIO_PHONE_NUMBER);
      try {
        await sendSMS(env, pref.notification_phone as string, smsText);
        console.log('[SMS] Successfully sent SMS to:', pref.notification_phone);
        
        // Log success
        await env.DB.prepare(
          `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, created_at, updated_at)
           VALUES (?, ?, 'sms', ?, 'success', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(pref.user_id, type, pref.notification_phone).run();
        
        results.textsSent++;
      } catch (error) {
        console.error('[SMS] Failed to send SMS notification:', error);
        console.error('[SMS] Error details:', JSON.stringify(error, null, 2));
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Log failure
        await env.DB.prepare(
          `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, error_message, created_at, updated_at)
           VALUES (?, ?, 'sms', ?, 'failed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(pref.user_id, type, pref.notification_phone, errorMessage).run();
        
        results.errors.push(`SMS to ${pref.notification_phone}: ${error}`);
      }
    } else {
      console.log('[SMS] Skipping SMS - opted in:', pref[textField], 'has phone:', !!pref.notification_phone, 'has Twilio:', !!env.TWILIO_ACCOUNT_SID);
    }
  }

  return results;
}

async function sendSMS(env: Env, to: string, message: string) {
  console.log('[sendSMS] Starting SMS send to:', to);
  console.log('[sendSMS] Message:', message);
  
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    console.error('[sendSMS] Missing Twilio credentials:', {
      hasSID: !!env.TWILIO_ACCOUNT_SID,
      hasAuth: !!env.TWILIO_AUTH_TOKEN,
      hasPhone: !!env.TWILIO_PHONE_NUMBER,
    });
    throw new Error('Twilio credentials not configured');
  }

  // Format phone number (ensure it has +1 prefix for US numbers)
  let formattedTo = to.replace(/\D/g, ''); // Remove non-digits
  if (formattedTo.length === 10) {
    formattedTo = `+1${formattedTo}`;
  } else if (formattedTo.length === 11 && formattedTo.startsWith('1')) {
    formattedTo = `+${formattedTo}`;
  } else if (!formattedTo.startsWith('+')) {
    formattedTo = `+${formattedTo}`;
  } else {
    formattedTo = `+${formattedTo}`;
  }

  console.log('[sendSMS] Formatted phone number:', formattedTo);
  console.log('[sendSMS] From phone:', env.TWILIO_PHONE_NUMBER);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  console.log('[sendSMS] Calling Twilio API...');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: formattedTo,
      From: env.TWILIO_PHONE_NUMBER,
      Body: message,
    }),
  });

  console.log('[sendSMS] Twilio response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('[sendSMS] Twilio API error response:', error);
    throw new Error(`Twilio API error: ${error}`);
  }

  const result = await response.json();
  console.log('[sendSMS] Twilio success response:', JSON.stringify(result, null, 2));
  return result;
}

export async function sendTestSMS(env: Env, to: string, message: string) {
  return sendSMS(env, to, message);
}
