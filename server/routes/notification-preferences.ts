import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.get("/notification-preferences", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM notification_preferences WHERE user_id = $1",
    [req.user!.id]
  );
  res.json({ preferences: result.rows[0] || null });
});

notificationPreferencesRouter.put("/notification-preferences", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const body = req.body;

  const existing = await pool.query(
    "SELECT id FROM notification_preferences WHERE user_id = $1",
    [userId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE notification_preferences SET
        notification_email = $1, notification_phone = $2,
        schedule_changes_email = $3, schedule_changes_text = $4,
        rsvp_requests_email = $5, rsvp_requests_text = $6,
        team_messages_email = $7, team_messages_text = $8,
        coach_messages_email = $9, coach_messages_text = $10,
        documents_email = $11, documents_text = $12,
        payment_reminders_email = $13, payment_reminders_text = $14,
        updated_at = NOW()
       WHERE user_id = $15`,
      [
        body.notification_email || null,
        body.notification_phone || null,
        !!body.schedule_changes_email,
        !!body.schedule_changes_text,
        !!body.rsvp_requests_email,
        !!body.rsvp_requests_text,
        !!body.team_messages_email,
        !!body.team_messages_text,
        !!body.coach_messages_email,
        !!body.coach_messages_text,
        !!body.documents_email,
        !!body.documents_text,
        !!body.payment_reminders_email,
        !!body.payment_reminders_text,
        userId,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO notification_preferences (
        user_id, notification_email, notification_phone,
        schedule_changes_email, schedule_changes_text,
        rsvp_requests_email, rsvp_requests_text,
        team_messages_email, team_messages_text,
        coach_messages_email, coach_messages_text,
        documents_email, documents_text,
        payment_reminders_email, payment_reminders_text,
        created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW())`,
      [
        userId,
        body.notification_email || null,
        body.notification_phone || null,
        !!body.schedule_changes_email,
        !!body.schedule_changes_text,
        !!body.rsvp_requests_email,
        !!body.rsvp_requests_text,
        !!body.team_messages_email,
        !!body.team_messages_text,
        !!body.coach_messages_email,
        !!body.coach_messages_text,
        !!body.documents_email,
        !!body.documents_text,
        !!body.payment_reminders_email,
        !!body.payment_reminders_text,
      ]
    );
  }

  res.json({ success: true });
});
