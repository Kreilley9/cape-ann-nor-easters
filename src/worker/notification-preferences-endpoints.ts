import { Hono } from "hono";
import type { Env } from "@/shared/types";

export function setupNotificationPreferencesEndpoints(
  app: Hono<{ Bindings: Env }>,
  authMiddleware: any
) {
  // Get current user's notification preferences
  app.get("/api/portal/notification-preferences", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = c.env.DB;
    
    const preferences = await db
      .prepare("SELECT * FROM notification_preferences WHERE user_id = ?")
      .bind(user.id)
      .first();

    return c.json({ preferences: preferences || null });
  });

  // Update current user's notification preferences
  app.put("/api/portal/notification-preferences", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user?.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = c.env.DB;
    const body = await c.req.json();

    // Check if preferences exist
    const existing = await db
      .prepare("SELECT id FROM notification_preferences WHERE user_id = ?")
      .bind(user.id)
      .first();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing preferences
      await db
        .prepare(`
          UPDATE notification_preferences SET
            notification_email = ?,
            notification_phone = ?,
            schedule_changes_email = ?,
            schedule_changes_text = ?,
            rsvp_requests_email = ?,
            rsvp_requests_text = ?,
            team_messages_email = ?,
            team_messages_text = ?,
            coach_messages_email = ?,
            coach_messages_text = ?,
            documents_email = ?,
            documents_text = ?,
            payment_reminders_email = ?,
            payment_reminders_text = ?,
            updated_at = ?
          WHERE user_id = ?
        `)
        .bind(
          body.notification_email || null,
          body.notification_phone || null,
          body.schedule_changes_email ? 1 : 0,
          body.schedule_changes_text ? 1 : 0,
          body.rsvp_requests_email ? 1 : 0,
          body.rsvp_requests_text ? 1 : 0,
          body.team_messages_email ? 1 : 0,
          body.team_messages_text ? 1 : 0,
          body.coach_messages_email ? 1 : 0,
          body.coach_messages_text ? 1 : 0,
          body.documents_email ? 1 : 0,
          body.documents_text ? 1 : 0,
          body.payment_reminders_email ? 1 : 0,
          body.payment_reminders_text ? 1 : 0,
          now,
          user.id
        )
        .run();
    } else {
      // Insert new preferences
      await db
        .prepare(`
          INSERT INTO notification_preferences (
            user_id,
            notification_email,
            notification_phone,
            schedule_changes_email,
            schedule_changes_text,
            rsvp_requests_email,
            rsvp_requests_text,
            team_messages_email,
            team_messages_text,
            coach_messages_email,
            coach_messages_text,
            documents_email,
            documents_text,
            payment_reminders_email,
            payment_reminders_text,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          user.id,
          body.notification_email || null,
          body.notification_phone || null,
          body.schedule_changes_email ? 1 : 0,
          body.schedule_changes_text ? 1 : 0,
          body.rsvp_requests_email ? 1 : 0,
          body.rsvp_requests_text ? 1 : 0,
          body.team_messages_email ? 1 : 0,
          body.team_messages_text ? 1 : 0,
          body.coach_messages_email ? 1 : 0,
          body.coach_messages_text ? 1 : 0,
          body.documents_email ? 1 : 0,
          body.documents_text ? 1 : 0,
          body.payment_reminders_email ? 1 : 0,
          body.payment_reminders_text ? 1 : 0,
          now,
          now
        )
        .run();
    }

    return c.json({ success: true });
  });
}