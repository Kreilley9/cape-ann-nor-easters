import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin, isAdmin } from "../middleware/roles.ts";
import { sendNotifications } from "../lib/notification-helper.ts";
import { sendEmail } from "../lib/email.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const paymentsRouter = Router();

paymentsRouter.get("/payments", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  if (adminCheck) {
    const result = await pool.query(`
      SELECT p.id, p.team_id, p.description, p.due_date, p.notes, p.payment_type, p.total_amount, p.created_at, t.name as team_name
      FROM payments p LEFT JOIN teams t ON p.team_id = t.id
      ORDER BY p.due_date DESC, p.created_at DESC
    `);
    res.json(result.rows); return;
  }
  const family = await pool.query("SELECT id FROM families WHERE user_id = $1", [req.user!.id]);
  if (!family.rows[0]) { res.json([]); return; }
  const players = await pool.query("SELECT id FROM players WHERE family_id = $1", [family.rows[0].id]);
  if (!players.rows.length) { res.json([]); return; }
  const playerIds = players.rows.map(p => p.id);
  const placeholders = playerIds.map((_, i) => `$${i + 1}`).join(",");
  const result = await pool.query(
    `SELECT pp.id, pp.payment_id, pp.player_id, pp.amount, pp.status, pp.paid_at,
            p.description, p.due_date, p.notes, p.team_id, t.name as team_name, pl.first_name, pl.last_name
     FROM player_payments pp
     JOIN payments p ON pp.payment_id = p.id
     LEFT JOIN teams t ON p.team_id = t.id
     JOIN players pl ON pp.player_id = pl.id
     WHERE pp.player_id IN (${placeholders})
     ORDER BY p.due_date DESC, p.created_at DESC`,
    playerIds
  );
  res.json(result.rows);
});

paymentsRouter.post("/payments", requireAuth, requireAdmin, async (req, res) => {
  const { team_id, description, due_date, notes, payment_type, amount, player_ids } = req.body;
  if (!description || !payment_type || !amount || !player_ids?.length) {
    res.status(400).json({ error: "description, payment_type, amount, player_ids required" }); return;
  }
  const amountPerPlayer = payment_type === "fixed" ? amount : amount / player_ids.length;
  const totalAmount = payment_type === "fixed" ? amount * player_ids.length : amount;
  const paymentResult = await pool.query(
    `INSERT INTO payments (team_id, description, due_date, status, notes, payment_type, total_amount, family_id, amount, updated_at)
     VALUES ($1,$2,$3,'pending',$4,$5,$6,0,0,NOW()) RETURNING id`,
    [team_id || null, description, due_date || null, notes || null, payment_type, totalAmount]
  );
  const paymentId = paymentResult.rows[0].id;
  for (const playerId of player_ids) {
    await pool.query(
      `INSERT INTO player_payments (payment_id, player_id, amount, status, updated_at) VALUES ($1,$2,$3,'pending',NOW())`,
      [paymentId, playerId, amountPerPlayer]
    );
  }
  await logActivity({
    userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created",
    entityType: "payment", entityId: paymentId, entityName: description,
    teamId: team_id, details: `$${totalAmount.toFixed(2)} - ${player_ids.length} player(s)`,
  });
  const team = team_id ? await pool.query("SELECT name FROM teams WHERE id=$1", [team_id]) : null;
  const teamName = team?.rows[0]?.name || "Team";
  const dueDate = due_date ? new Date(due_date).toLocaleDateString("en-US", { timeZone: "America/New_York", dateStyle: "medium" }) : "No due date";
  await sendNotifications({
    type: "payment_reminders",
    subject: `Payment Due: ${description}`,
    emailHtml: `<h2>New Payment Due</h2><p><strong>Team:</strong> ${teamName}</p><p><strong>Description:</strong> ${description}</p><p><strong>Amount:</strong> $${amountPerPlayer.toFixed(2)} per player</p><p><strong>Due Date:</strong> ${dueDate}</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}${process.env.VENMO_HANDLE ? `<p><em>Payment can be made via Venmo to ${process.env.VENMO_HANDLE}</em></p>` : ""}`,
    smsText: `New payment due: ${description} - $${amountPerPlayer.toFixed(2)}. Due ${dueDate}.`,
    teamId: team_id,
  }).catch(err => console.error("Failed to send payment notifications:", err));
  res.status(201).json({ id: paymentId });
});

paymentsRouter.put("/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  const { team_id, description, due_date, notes, payment_type, amount, player_ids } = req.body;
  const amountPerPlayer = payment_type === "fixed" ? amount : amount / player_ids.length;
  const totalAmount = payment_type === "fixed" ? amount * player_ids.length : amount;
  await pool.query(
    `UPDATE payments SET team_id=$1, description=$2, due_date=$3, notes=$4, payment_type=$5, total_amount=$6, updated_at=NOW() WHERE id=$7`,
    [team_id || null, description, due_date || null, notes || null, payment_type, totalAmount, req.params.id]
  );
  await pool.query("DELETE FROM player_payments WHERE payment_id=$1", [req.params.id]);
  for (const playerId of player_ids) {
    await pool.query(
      `INSERT INTO player_payments (payment_id, player_id, amount, status, updated_at) VALUES ($1,$2,$3,'pending',NOW())`,
      [req.params.id, playerId, amountPerPlayer]
    );
  }
  res.json({ success: true });
});

paymentsRouter.delete("/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM player_payments WHERE payment_id=$1", [req.params.id]);
  await pool.query("DELETE FROM payments WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

paymentsRouter.get("/all-player-payments", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(`
    SELECT pp.id, pp.payment_id, pp.player_id, pp.amount, pp.status, pp.paid_at,
           pp.waived_at, pp.waived_by_name, pp.waiver_reason,
           pl.first_name, pl.last_name, pl.jersey_number, pl.family_id,
           f.name as family_name, p.team_id, p.description, p.due_date, t.name as team_name
    FROM player_payments pp
    JOIN players pl ON pp.player_id = pl.id
    LEFT JOIN families f ON pl.family_id = f.id
    JOIN payments p ON pp.payment_id = p.id
    LEFT JOIN teams t ON p.team_id = t.id
    ORDER BY pp.created_at DESC
  `);
  res.json(result.rows);
});

paymentsRouter.get("/payments/:id/players", requireAuth, async (req, res) => {
  const result = await pool.query(`
    SELECT pp.id, pp.player_id, pp.amount, pp.status, pp.paid_at,
           p.first_name, p.last_name, p.jersey_number, f.name as family_name
    FROM player_payments pp
    JOIN players p ON pp.player_id = p.id
    LEFT JOIN families f ON p.family_id = f.id
    WHERE pp.payment_id = $1 ORDER BY p.last_name, p.first_name
  `, [req.params.id]);
  res.json(result.rows);
});

paymentsRouter.put("/player-payments/:id", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (status === undefined) { res.status(400).json({ error: "No updates provided" }); return; }
  const updates = ["status = $1", status === "paid" ? "paid_at = NOW()" : "paid_at = NULL", "updated_at = NOW()"];
  await pool.query(`UPDATE player_payments SET ${updates.join(", ")} WHERE id = $2`, [status, req.params.id]);
  const pp = await pool.query(`
    SELECT pp.*, p.first_name, p.last_name, pay.description
    FROM player_payments pp JOIN players p ON pp.player_id = p.id JOIN payments pay ON pp.payment_id = pay.id
    WHERE pp.id = $1
  `, [req.params.id]);
  if (pp.rows[0]) {
    await logActivity({
      userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "updated",
      entityType: "payment", entityId: Number(req.params.id), entityName: pp.rows[0].description,
      details: `${pp.rows[0].first_name} ${pp.rows[0].last_name} - ${status}`,
    });
  }
  res.json({ success: true });
});

paymentsRouter.post("/player-payments/:id/waive", requireAuth, requireAdmin, async (req, res) => {
  const { waiver_reason } = req.body;
  const pp = await pool.query(`
    SELECT pp.*, p.first_name, p.last_name, p.family_id,
           pay.description, pay.due_date,
           f.name as family_name, f.email as family_email,
           p.parent_1_email, p.parent_2_email
    FROM player_payments pp
    JOIN players p ON pp.player_id = p.id
    JOIN payments pay ON pp.payment_id = pay.id
    LEFT JOIN families f ON p.family_id = f.id
    WHERE pp.id = $1
  `, [req.params.id]);
  if (!pp.rows[0]) { res.status(404).json({ error: "Payment not found" }); return; }
  const payment = pp.rows[0];
  const userName = req.user!.email || "Admin";
  await pool.query(`
    UPDATE player_payments SET status='waived', waived_at=NOW(), waived_by_user_id=$1, waived_by_name=$2, waiver_reason=$3, updated_at=NOW() WHERE id=$4
  `, [req.user!.id, userName, waiver_reason || null, req.params.id]);
  const recipientEmail = payment.family_email || payment.parent_1_email || payment.parent_2_email;
  if (recipientEmail) {
    const waivedDate = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" });
    await sendEmail({
      to: recipientEmail,
      subject: "Fee Waiver - Cape Ann Nor'easters",
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:sans-serif;background:#f4f4f5;">
        <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#00c4ff,#0099cc);padding:24px 40px;"><h1 style="margin:0;color:#fff;font-size:24px;">Cape Ann Nor'easters</h1></div>
          <div style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#18181b;">Fee Waiver Notification</h2>
            <p style="color:#3f3f46;">A fee has been waived for your family.</p>
            <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:24px 0;">
              <p style="color:#71717a;font-size:14px;margin:0 0 8px;">Player</p>
              <p style="color:#18181b;font-weight:600;margin:0 0 16px;">${payment.first_name} ${payment.last_name}</p>
              <p style="color:#71717a;font-size:14px;margin:0 0 8px;">Description</p>
              <p style="color:#18181b;font-weight:600;margin:0 0 16px;">${payment.description}</p>
              <p style="color:#71717a;font-size:14px;margin:0 0 8px;">Amount Waived</p>
              <p style="color:#22c55e;font-size:20px;font-weight:600;margin:0 0 16px;">$${Number(payment.amount).toFixed(2)}</p>
              ${waiver_reason ? `<p style="color:#71717a;font-size:14px;margin:0 0 8px;">Reason</p><p style="color:#18181b;">${waiver_reason}</p>` : ""}
            </div>
            <p style="color:#71717a;font-size:14px;">Waived by ${userName} on ${waivedDate}</p>
          </div>
        </div>
      </body></html>`,
    }).catch(err => console.error("Failed to send waiver email:", err));
  }
  await logActivity({
    userId: req.user!.id, userName, action: "waived", entityType: "payment",
    entityId: Number(req.params.id), entityName: payment.description, familyId: payment.family_id,
    details: `${payment.first_name} ${payment.last_name} - $${Number(payment.amount).toFixed(2)}${waiver_reason ? ` - ${waiver_reason}` : ""}`,
  });
  res.json({ success: true });
});
