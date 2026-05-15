import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";
import { sendNotifications } from "../lib/notification-helper.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { canManageEvents } from "../lib/permissions-helper.ts";

export const eventsRouter = Router();

eventsRouter.get("/events", requireAuth, async (req, res) => {
  const { start, end, team_id } = req.query as Record<string, string>;
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const familyId = await getFamilyId(req.user!.id);
  const isParent = !adminCheck && !isCoach && !!familyId;

  let query = `
    SELECT e.*, t.name as team_name,
      COALESCE(SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END),0) as rsvp_yes,
      COALESCE(SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END),0) as rsvp_no,
      COALESCE(SUM(CASE WHEN a.status='maybe' THEN 1 ELSE 0 END),0) as rsvp_maybe,
      COALESCE(COUNT(DISTINCT ei.player_id),0) as total_invited,
      COALESCE(COUNT(DISTINCT ei.player_id),0) - COALESCE(COUNT(DISTINCT a.player_id),0) as rsvp_no_response
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN event_invites ei ON e.id = ei.event_id
    LEFT JOIN attendance a ON e.id = a.event_id AND ei.player_id = a.player_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let idx = 1;

  if (isParent && familyId) {
    query += ` AND e.id IN (SELECT DISTINCT ei2.event_id FROM event_invites ei2 JOIN players p ON ei2.player_id = p.id WHERE p.family_id = $${idx++})`;
    params.push(familyId);
  }
  if (start) { query += ` AND e.start_at >= $${idx++}`; params.push(start); }
  if (end) { query += ` AND e.start_at <= $${idx++}`; params.push(end); }
  if (team_id) { query += ` AND (e.team_id = $${idx++} OR e.team_id IS NULL)`; params.push(team_id); }
  query += " GROUP BY e.id, t.name ORDER BY e.start_at ASC";

  const result = await pool.query(query, params);
  res.json(result.rows);
});

eventsRouter.post("/events", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const canManage = await canManageEvents(req.user!.id);
  if (!adminCheck && !canManage) { res.status(403).json({ error: "Event management access denied" }); return; }
  const { team_id, event_type, title, description, location, start_at, end_at, cost, player_ids } = req.body;
  if (!event_type || !title || !start_at) { res.status(400).json({ error: "event_type, title, start_at required" }); return; }
  const result = await pool.query(
    `INSERT INTO events (team_id, event_type, title, description, location, start_at, end_at, cost, is_cancelled, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,NOW()) RETURNING id`,
    [team_id || null, event_type, title, description || null, location || null, start_at, end_at || null, cost ?? null]
  );
  const eventId = result.rows[0].id;
  if (player_ids?.length) {
    for (const playerId of player_ids) {
      await pool.query(`INSERT INTO event_invites (event_id, player_id, updated_at) VALUES ($1,$2,NOW())`, [eventId, playerId]);
    }
  }
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "event", entityId: eventId, entityName: title, teamId: team_id, details: event_type });
  const eventTime = new Date(start_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
  await sendNotifications({
    type: "schedule_changes",
    subject: `New Event: ${title}`,
    emailHtml: `<h2>New Event Added to Schedule</h2><p><strong>Event:</strong> ${title}</p><p><strong>Type:</strong> ${event_type}</p><p><strong>Date & Time:</strong> ${eventTime}</p>${location ? `<p><strong>Location:</strong> ${location}</p>` : ""}${description ? `<p><strong>Details:</strong> ${description}</p>` : ""}`,
    smsText: `New event: ${title} on ${eventTime}${location ? " at " + location : ""}.`,
    teamId: team_id,
  }).catch(err => console.error("Failed to send schedule notifications:", err));
  res.status(201).json({ id: eventId });
});

eventsRouter.patch("/events/:id", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const canManage = await canManageEvents(req.user!.id);
  if (!adminCheck && !canManage) { res.status(403).json({ error: "Event management access denied" }); return; }
  const { player_ids, ...fields } = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    if (key === "is_cancelled") {
      updates.push(`${key} = $${idx++}`);
      values.push(!!value);
    } else {
      updates.push(`${key} = $${idx++}`);
      values.push(value === "" ? null : value);
    }
  }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    await pool.query(`UPDATE events SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  }
  if (player_ids !== undefined) {
    await pool.query("DELETE FROM event_invites WHERE event_id = $1", [req.params.id]);
    for (const playerId of player_ids) {
      await pool.query(`INSERT INTO event_invites (event_id, player_id, updated_at) VALUES ($1,$2,NOW())`, [req.params.id, playerId]);
    }
  }
  if (updates.length > 0) {
    const event = await pool.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (event.rows[0]) {
      const e = event.rows[0];
      const eventTime = new Date(e.start_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });
      await sendNotifications({
        type: "schedule_changes",
        subject: `Schedule Update: ${e.title}`,
        emailHtml: `<h2>Event Updated</h2><p><strong>Event:</strong> ${e.title}</p><p><strong>Date & Time:</strong> ${eventTime}</p>${e.location ? `<p><strong>Location:</strong> ${e.location}</p>` : ""}${e.is_cancelled ? '<p style="color:red"><strong>STATUS: CANCELLED</strong></p>' : ""}`,
        smsText: `Event updated: ${e.title} on ${eventTime}${e.is_cancelled ? " - CANCELLED" : ""}.`,
        teamId: e.team_id,
      }).catch(err => console.error("Failed to send update notifications:", err));
    }
  }
  res.json({ success: true });
});

eventsRouter.delete("/events/:id", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const canManage = await canManageEvents(req.user!.id);
  if (!adminCheck && !canManage) { res.status(403).json({ error: "Event management access denied" }); return; }
  await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

eventsRouter.post("/events/:eventId/rsvp/:playerId", requireAuth, async (req, res) => {
  const { eventId, playerId } = req.params;
  const { status } = req.body;
  if (!["present", "absent", "maybe"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  // Verify the requesting user can access this player
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  if (!adminCheck) {
    const userRoles = await getUserRoles(req.user!.id);
    const isCoach = userRoles.some(r => r.role === "coach");
    if (!isCoach) {
      const familyId = await getFamilyId(req.user!.id);
      const playerRow = await pool.query("SELECT family_id FROM players WHERE id = $1", [playerId]);
      if (!playerRow.rows[0] || playerRow.rows[0].family_id !== familyId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }
  }

  const existing = await pool.query("SELECT id FROM attendance WHERE event_id=$1 AND player_id=$2", [eventId, playerId]);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE attendance SET status=$1, responded_by_user_id=$2, responded_at=NOW(), updated_at=NOW() WHERE id=$3`,
      [status, req.user!.id, existing.rows[0].id]
    );
    await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated", entityType: "rsvp", entityId: existing.rows[0].id, entityName: `Event #${eventId}`, details: `Player #${playerId} - ${status}` });
    res.json({ success: true, updated: true }); return;
  }
  const result = await pool.query(
    `INSERT INTO attendance (event_id, player_id, status, responded_by_user_id, responded_at, updated_at)
     VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
    [eventId, playerId, status, req.user!.id]
  );
  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "rsvp", entityId: result.rows[0].id, entityName: `Event #${eventId}`, details: `Player #${playerId} - ${status}` });
  res.status(201).json({ success: true, id: result.rows[0].id });
});

eventsRouter.get("/events/:eventId/rsvps", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT COALESCE(a.id, ei.id) as id, a.status, a.responded_at,
           p.id as player_id, p.first_name, p.last_name, f.name as family_name
    FROM event_invites ei
    JOIN players p ON ei.player_id = p.id
    JOIN families f ON p.family_id = f.id
    LEFT JOIN attendance a ON a.event_id = ei.event_id AND a.player_id = ei.player_id
    WHERE ei.event_id = $1
    ORDER BY p.last_name ASC, p.first_name ASC
  `, [req.params.eventId]);
  res.json(result.rows);
});

eventsRouter.get("/my-events", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT e.id, e.title, e.event_type, e.description, e.location, e.start_at, e.end_at, e.cost, t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    JOIN event_invites ei ON ei.event_id = e.id
    JOIN players p ON p.id = ei.player_id
    JOIN families f ON f.id = p.family_id
    JOIN user_roles ur ON ur.family_id = f.id
    WHERE ur.user_id = $1 AND LOWER(ur.role) = 'parent' AND e.start_at >= NOW() AND e.is_cancelled = FALSE
    ORDER BY e.start_at ASC
  `, [req.user!.id]);
  const eventsWithRsvps = await Promise.all(
    result.rows.map(async (event) => {
      const rsvps = await pool.query(`
        SELECT a.player_id, a.status FROM attendance a
        JOIN players p ON p.id = a.player_id
        JOIN families f ON f.id = p.family_id
        JOIN user_roles ur ON ur.family_id = f.id
        WHERE a.event_id = $1 AND ur.user_id = $2 AND LOWER(ur.role) = 'parent'
      `, [event.id, req.user!.id]);
      const rsvpMap: Record<number, string> = {};
      rsvps.rows.forEach(r => { rsvpMap[r.player_id] = r.status; });
      return { ...event, rsvps: rsvpMap };
    })
  );
  res.json(eventsWithRsvps);
});

eventsRouter.get("/my-players", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT p.id, p.first_name, p.last_name, p.birth_date, p.jersey_number
    FROM players p
    JOIN families f ON f.id = p.family_id
    JOIN user_roles ur ON ur.family_id = f.id
    WHERE ur.user_id = $1 AND LOWER(ur.role) = 'parent'
    ORDER BY p.first_name ASC, p.last_name ASC
  `, [req.user!.id]);
  res.json(result.rows);
});
