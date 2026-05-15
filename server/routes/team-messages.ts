import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { sendNotifications } from "../lib/notification-helper.ts";

export const teamMessagesRouter = Router();

async function canAccessTeam(userId: string, userEmail: string, teamId: number): Promise<boolean> {
  if (await isAdmin(userId, userEmail)) return true;
  const roles = await getUserRoles(userId);
  if (roles.some((r) => r.role === "coach" && r.team_id === teamId)) return true;
  const familyRole = roles.find((r) => r.role === "parent" && r.family_id);
  if (familyRole?.family_id) {
    const check = await pool.query(
      `SELECT tp.id FROM team_players tp JOIN players p ON p.id = tp.player_id
       WHERE tp.team_id = $1 AND p.family_id = $2 LIMIT 1`,
      [teamId, familyRole.family_id]
    );
    if (check.rows.length > 0) return true;
  }
  return false;
}

teamMessagesRouter.get("/teams/:teamId/messages", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!(await canAccessTeam(req.user!.id, req.user!.email!, teamId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const result = await pool.query(
    `SELECT m.*, COUNT(r.id) as reply_count
     FROM team_messages m
     LEFT JOIN team_message_replies r ON m.id = r.message_id
     WHERE m.team_id = $1
     GROUP BY m.id
     ORDER BY m.is_pinned DESC, m.created_at DESC`,
    [teamId]
  );
  res.json(result.rows);
});

teamMessagesRouter.get("/teams/:teamId/messages/:id", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!(await canAccessTeam(req.user!.id, req.user!.email!, teamId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const message = await pool.query(
    "SELECT * FROM team_messages WHERE id = $1 AND team_id = $2",
    [req.params.id, teamId]
  );
  if (!message.rows[0]) { res.status(404).json({ error: "Message not found" }); return; }
  const replies = await pool.query(
    "SELECT * FROM team_message_replies WHERE message_id = $1 ORDER BY created_at ASC",
    [req.params.id]
  );
  res.json({ message: message.rows[0], replies: replies.rows });
});

teamMessagesRouter.post("/teams/:teamId/messages", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!(await canAccessTeam(req.user!.id, req.user!.email!, teamId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { title, content } = req.body;
  if (!title || !content) { res.status(400).json({ error: "title and content required" }); return; }
  const userName = getUserDisplayName(req.user!);
  const result = await pool.query(
    `INSERT INTO team_messages (team_id, title, content, author_user_id, author_name)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [teamId, title, content, req.user!.id, userName]
  );
  const msgId = result.rows[0].id;
  await logActivity({ userId: req.user!.id, userName, action: "created", entityType: "team_message", entityId: msgId, entityName: title, teamId });
  const teamRow = await pool.query("SELECT name FROM teams WHERE id = $1", [teamId]);
  const teamName = teamRow.rows[0]?.name || "Team";
  await sendNotifications({
    type: "team_messages",
    subject: `Team Message: ${title}`,
    emailHtml: `<h2>New Team Message</h2><p><strong>Team:</strong> ${teamName}</p><p><strong>From:</strong> ${userName}</p><p><strong>Subject:</strong> ${title}</p><p>${content.replace(/\n/g, "<br>")}</p>`,
    smsText: `New team message from ${userName}: ${title}. View at capeannnoreasters.com/portal/teams/${teamId}`,
    teamId,
  }).catch(() => {});
  res.json({ id: msgId });
});

teamMessagesRouter.post("/teams/:teamId/messages/:id/replies", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!(await canAccessTeam(req.user!.id, req.user!.email!, teamId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const userName = getUserDisplayName(req.user!);
  const result = await pool.query(
    `INSERT INTO team_message_replies (message_id, content, author_user_id, author_name)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [req.params.id, content, req.user!.id, userName]
  );
  await logActivity({ userId: req.user!.id, userName, action: "replied", entityType: "team_message", entityId: Number(req.params.id), details: "Added a reply", teamId });
  res.json({ id: result.rows[0].id });
});

teamMessagesRouter.put("/teams/:teamId/messages/:id/pin", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  const adminCheck = await isAdmin(req.user!.id, req.user!.email!);
  const roles = await getUserRoles(req.user!.id);
  const isCoachForTeam = roles.some((r) => r.role === "coach" && r.team_id === teamId);
  if (!adminCheck && !isCoachForTeam) { res.status(403).json({ error: "Forbidden" }); return; }
  const msg = await pool.query("SELECT * FROM team_messages WHERE id = $1 AND team_id = $2", [req.params.id, teamId]);
  if (!msg.rows[0]) { res.status(404).json({ error: "Message not found" }); return; }
  const newPin = !msg.rows[0].is_pinned;
  await pool.query("UPDATE team_messages SET is_pinned = $1 WHERE id = $2", [newPin, req.params.id]);
  res.json({ success: true, is_pinned: newPin });
});

teamMessagesRouter.delete("/teams/:teamId/messages/:id", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  const adminCheck = await isAdmin(req.user!.id, req.user!.email!);
  const roles = await getUserRoles(req.user!.id);
  const isCoachForTeam = roles.some((r) => r.role === "coach" && r.team_id === teamId);
  if (!adminCheck && !isCoachForTeam) { res.status(403).json({ error: "Forbidden" }); return; }
  const msg = await pool.query("SELECT * FROM team_messages WHERE id = $1 AND team_id = $2", [req.params.id, teamId]);
  const userName = getUserDisplayName(req.user!);
  await pool.query("DELETE FROM team_message_replies WHERE message_id = $1", [req.params.id]);
  await pool.query("DELETE FROM team_messages WHERE id = $1", [req.params.id]);
  if (msg.rows[0]) {
    await logActivity({ userId: req.user!.id, userName, action: "deleted", entityType: "team_message", entityId: Number(req.params.id), entityName: msg.rows[0].title, teamId });
  }
  res.json({ success: true });
});
