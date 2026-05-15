import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";

export const reservationsRouter = Router();

reservationsRouter.post("/reservations", async (req, res) => {
  const { board_id, square_idx, buyer_name, email, venmo_handle } = req.body;
  if (!board_id || !square_idx || !buyer_name || !email) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const board = await pool.query("SELECT is_open FROM boards WHERE id = $1", [board_id]);
  if (!board.rows[0]) { res.status(404).json({ error: "Board not found" }); return; }
  if (!board.rows[0].is_open) { res.status(400).json({ error: "Board is closed" }); return; }
  const existing = await pool.query(
    "SELECT id FROM reservations WHERE board_id = $1 AND square_idx = $2",
    [board_id, square_idx - 1]
  );
  if (existing.rows.length > 0) { res.status(400).json({ error: "Square already reserved" }); return; }
  const result = await pool.query(
    `INSERT INTO reservations (board_id, square_idx, buyer_name, email, venmo_handle, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id`,
    [board_id, square_idx - 1, buyer_name, email, venmo_handle || null]
  );
  res.status(201).json({ id: result.rows[0].id });
});

reservationsRouter.get("/reservations", requireAuth, requireAdmin, async (req, res) => {
  const { board_id } = req.query;
  if (!board_id) { res.status(400).json({ error: "board_id query parameter required" }); return; }
  const result = await pool.query(
    "SELECT * FROM reservations WHERE board_id = $1 ORDER BY square_idx ASC",
    [board_id]
  );
  res.json(result.rows);
});

reservationsRouter.patch("/reservations/:id/paid", requireAuth, requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE reservations SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1",
    [req.params.id]
  );
  res.json({ success: true });
});

reservationsRouter.patch("/reservations/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(req.body)) {
    updates.push(`${key} = $${i++}`);
    values.push(value === "" ? null : value);
  }
  updates.push("updated_at = NOW()");
  values.push(id);
  await pool.query(`UPDATE reservations SET ${updates.join(", ")} WHERE id = $${i}`, values);
  res.json({ success: true });
});

reservationsRouter.delete("/reservations/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM reservations WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});
