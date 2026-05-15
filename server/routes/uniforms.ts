import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const uniformsRouter = Router();

uniformsRouter.post("/uniform-orders", requireAuth, async (req, res) => {
  const {
    player_id, team_id, jersey_material, jersey_type, jersey_size, jersey_number, jersey_name, jersey_color,
    shorts_size, shorts_material, is_female, leggings_size, fleece_hoodie_size, fleece_hoodie_color,
    fleece_joggers_size, fleece_joggers_color, backpack_size, has_flag_sets, duffle_bag_size,
    drawstring_bags_qty, arm_sleeves_qty, bomber_jacket_qty, combo_total, addons_total, items_total,
    order_total, comments,
  } = req.body;
  if (!player_id) { res.status(400).json({ error: "player_id required" }); return; }
  const playerRow = await pool.query("SELECT id, first_name, last_name, family_id FROM players WHERE id = $1", [player_id]);
  if (!playerRow.rows[0]) { res.status(404).json({ error: "Player not found" }); return; }
  const player = playerRow.rows[0];
  const orderResult = await pool.query(`
    INSERT INTO uniform_orders (
      player_id, team_id, status,
      jersey_material, jersey_type, jersey_size, jersey_number, jersey_name, jersey_color,
      shorts_size, shorts_material, is_female,
      leggings_size, fleece_hoodie_size, fleece_hoodie_color, fleece_joggers_size, fleece_joggers_color,
      backpack_size, has_flag_sets, duffle_bag_size, drawstring_bags_qty, arm_sleeves_qty, bomber_jacket_qty,
      combo_total, addons_total, items_total, order_total, comments,
      ordered_by_user_id, submitted_at, created_at, updated_at
    ) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,NOW(),NOW(),NOW()) RETURNING id`,
    [player_id, team_id || null, jersey_material || null, jersey_type || null, jersey_size || null,
     jersey_number || null, jersey_name || null, jersey_color || null, shorts_size || null, shorts_material || null,
     !!is_female, leggings_size || null, fleece_hoodie_size || null, fleece_hoodie_color || null,
     fleece_joggers_size || null, fleece_joggers_color || null, backpack_size || null, !!has_flag_sets,
     duffle_bag_size || null, drawstring_bags_qty || 0, arm_sleeves_qty || 0, bomber_jacket_qty || 0,
     combo_total || 0, addons_total || 0, items_total || 0, order_total || 0, comments || null, req.user!.id]
  );
  const orderId = orderResult.rows[0].id;
  if (order_total && order_total > 0) {
    const paymentResult = await pool.query(`
      INSERT INTO payments (family_id, description, payment_type, amount, total_amount, due_date, team_id, created_at, updated_at)
      VALUES ($1,$2,'fixed',$3,$4,NULL,$5,NOW(),NOW()) RETURNING id`,
      [player.family_id, `Uniform Order - ${player.first_name} ${player.last_name}`, order_total, order_total, team_id || null]
    );
    const paymentId = paymentResult.rows[0].id;
    await pool.query(`INSERT INTO player_payments (payment_id, player_id, amount, status, created_at, updated_at) VALUES ($1,$2,$3,'unpaid',NOW(),NOW())`, [paymentId, player_id, order_total]);
    await pool.query("UPDATE uniform_orders SET payment_id=$1 WHERE id=$2", [paymentId, orderId]);
  }
  await logActivity({
    userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created",
    entityType: "uniform_order", entityId: orderId, entityName: `${player.first_name} ${player.last_name}`,
    teamId: team_id, familyId: Number(player.family_id), details: `$${order_total || 0}`,
  });
  res.status(201).json({ id: orderId, success: true });
});

uniformsRouter.get("/uniform-orders", requireAuth, async (req, res) => {
  const { team_id, status } = req.query as Record<string, string>;
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isParent = roles.some(r => r.role === "parent");
  const isCoach = roles.some(r => r.role === "coach");
  const familyId = await getFamilyId(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);

  let query = `
    SELECT uo.*, p.first_name, p.last_name, t.name as team_name,
           pp.status as payment_status
    FROM uniform_orders uo
    LEFT JOIN players p ON uo.player_id = p.id
    LEFT JOIN teams t ON uo.team_id = t.id
    LEFT JOIN player_payments pp ON uo.payment_id = pp.payment_id AND uo.player_id = pp.player_id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let idx = 1;

  if (!adminCheck) {
    if (isParent && familyId) {
      query += ` AND p.family_id = $${idx++}`; params.push(familyId);
    } else if (isCoach && coachTeamIds.length > 0) {
      const phs = coachTeamIds.map(() => `$${idx++}`).join(",");
      query += ` AND uo.team_id IN (${phs})`; params.push(...coachTeamIds);
    }
  }
  if (team_id) { query += ` AND uo.team_id = $${idx++}`; params.push(team_id); }
  if (status) { query += ` AND uo.status = $${idx++}`; params.push(status); }
  query += " ORDER BY uo.created_at DESC";

  const result = await pool.query(query, params);
  res.json(result.rows);
});

uniformsRouter.put("/uniform-orders/:id", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const familyId = await getFamilyId(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);

  const order = await pool.query(
    `SELECT uo.*, p.family_id FROM uniform_orders uo LEFT JOIN players p ON uo.player_id = p.id WHERE uo.id = $1`,
    [req.params.id]
  );
  if (!order.rows[0]) { res.status(404).json({ error: "Order not found" }); return; }
  const o = order.rows[0];
  if (!adminCheck) {
    if (familyId && o.family_id !== familyId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (isCoach && !coachTeamIds.includes(o.team_id)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  await pool.query("UPDATE uniform_orders SET status=$1, updated_at=NOW() WHERE id=$2", [req.body.status, req.params.id]);
  res.json({ success: true });
});

uniformsRouter.delete("/uniform-orders/:id", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const familyId = await getFamilyId(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);

  const order = await pool.query(
    `SELECT uo.*, p.family_id FROM uniform_orders uo LEFT JOIN players p ON uo.player_id = p.id WHERE uo.id = $1`,
    [req.params.id]
  );
  if (!order.rows[0]) { res.status(404).json({ error: "Order not found" }); return; }
  const o = order.rows[0];
  if (!adminCheck) {
    if (familyId && o.family_id !== familyId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (isCoach && !coachTeamIds.includes(o.team_id)) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  if (o.payment_id) {
    await pool.query("DELETE FROM player_payments WHERE payment_id=$1 AND player_id=$2", [o.payment_id, o.player_id]);
    await pool.query("DELETE FROM payments WHERE id=$1", [o.payment_id]);
  }
  await pool.query("DELETE FROM uniform_orders WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});
