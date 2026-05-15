import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";

export const boardsRouter = Router();

function shuffle(array: number[]): number[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

boardsRouter.post("/boards", requireAuth, requireAdmin, async (req, res) => {
  const { slug, title, team_top, team_side, game_date, cost_per_square, venmo_handle, is_open, payout_mode, payouts, lock_at } = req.body;
  const existing = await pool.query("SELECT id FROM boards WHERE slug = $1", [slug]);
  if (existing.rows.length > 0) { res.status(400).json({ error: "Board with this slug already exists" }); return; }
  const result = await pool.query(
    `INSERT INTO boards (slug, title, team_top, team_side, game_date, cost_per_square, venmo_handle, is_open, payout_mode, payouts, lock_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING id`,
    [slug, title, team_top, team_side, game_date, cost_per_square, venmo_handle, !!is_open, payout_mode, JSON.stringify(payouts), lock_at]
  );
  res.status(201).json({ id: result.rows[0].id });
});

boardsRouter.get("/boards", async (_req, res) => {
  const result = await pool.query("SELECT * FROM boards ORDER BY created_at DESC");
  res.json(result.rows.map((b: Record<string, unknown>) => ({
    ...b,
    payouts: typeof b.payouts === "string" ? JSON.parse(b.payouts) : b.payouts,
    scores: b.scores ? (typeof b.scores === "string" ? JSON.parse(b.scores) : b.scores) : null,
    top_nums: b.top_nums ? (typeof b.top_nums === "string" ? JSON.parse(b.top_nums) : b.top_nums) : null,
    side_nums: b.side_nums ? (typeof b.side_nums === "string" ? JSON.parse(b.side_nums) : b.side_nums) : null,
  })));
});

boardsRouter.get("/boards/:slug", async (req, res) => {
  const result = await pool.query("SELECT * FROM boards WHERE slug = $1", [req.params.slug]);
  const board = result.rows[0];
  if (!board) { res.status(404).json({ error: "Board not found" }); return; }
  res.json({
    ...board,
    payouts: typeof board.payouts === "string" ? JSON.parse(board.payouts) : board.payouts,
    scores: board.scores ? (typeof board.scores === "string" ? JSON.parse(board.scores) : board.scores) : null,
    top_nums: board.top_nums ? (typeof board.top_nums === "string" ? JSON.parse(board.top_nums) : board.top_nums) : null,
    side_nums: board.side_nums ? (typeof board.side_nums === "string" ? JSON.parse(board.side_nums) : board.side_nums) : null,
  });
});

boardsRouter.patch("/boards/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(data)) {
    if (key === "payouts") { updates.push(`payouts = $${i++}`); values.push(JSON.stringify(value)); }
    else if (key === "is_open") { updates.push(`is_open = $${i++}`); values.push(!!value); }
    else { updates.push(`${key} = $${i++}`); values.push(value); }
  }
  updates.push("updated_at = NOW()");
  values.push(id);
  await pool.query(`UPDATE boards SET ${updates.join(", ")} WHERE id = $${i}`, values);
  res.json({ success: true });
});

boardsRouter.delete("/boards/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM reservations WHERE board_id = $1", [req.params.id]);
  await pool.query("DELETE FROM boards WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

boardsRouter.post("/boards/:id/randomize", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const board = await pool.query("SELECT * FROM boards WHERE id = $1", [id]);
  if (!board.rows[0]) { res.status(404).json({ error: "Board not found" }); return; }
  if (board.rows[0].randomized_at) { res.status(400).json({ error: "Board already randomized" }); return; }
  const count = await pool.query("SELECT COUNT(*) as count FROM reservations WHERE board_id = $1", [id]);
  if (Number(count.rows[0].count) < 100) { res.status(400).json({ error: "Board must be full (100/100) before randomizing" }); return; }
  const topNums = shuffle([0,1,2,3,4,5,6,7,8,9]);
  const sideNums = shuffle([0,1,2,3,4,5,6,7,8,9]);
  await pool.query(
    "UPDATE boards SET top_nums = $1, side_nums = $2, randomized_at = NOW(), updated_at = NOW() WHERE id = $3",
    [JSON.stringify(topNums), JSON.stringify(sideNums), id]
  );
  res.json({ topNums, sideNums });
});

boardsRouter.patch("/boards/:id/scores", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("UPDATE boards SET scores = $1, updated_at = NOW() WHERE id = $2", [JSON.stringify(req.body), req.params.id]);
  res.json({ success: true });
});

boardsRouter.get("/boards/:slug/reservations", async (req, res) => {
  const board = await pool.query("SELECT id FROM boards WHERE slug = $1", [req.params.slug]);
  if (!board.rows[0]) { res.status(404).json({ error: "Board not found" }); return; }
  const result = await pool.query(
    "SELECT square_idx, buyer_name, email, status FROM reservations WHERE board_id = $1",
    [board.rows[0].id]
  );
  res.json(result.rows);
});
