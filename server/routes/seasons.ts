import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";

export const seasonsRouter = Router();

seasonsRouter.get("/seasons", requireAuth, async (_req, res) => {
  const result = await pool.query("SELECT * FROM seasons ORDER BY year DESC, name ASC");
  res.json(result.rows);
});

seasonsRouter.post("/seasons", requireAuth, requireAdmin, async (req, res) => {
  const { name, year, start_date, end_date } = req.body;
  if (!name || !year) { res.status(400).json({ error: "name and year required" }); return; }
  const result = await pool.query(
    "INSERT INTO seasons (name, year, start_date, end_date, updated_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id",
    [name, year, start_date || null, end_date || null]
  );
  res.status(201).json({ id: result.rows[0].id });
});

seasonsRouter.put("/seasons/:id", requireAuth, requireAdmin, async (req, res) => {
  const { name, year, start_date, end_date } = req.body;
  await pool.query(
    "UPDATE seasons SET name = $1, year = $2, start_date = $3, end_date = $4, updated_at = NOW() WHERE id = $5",
    [name, year, start_date || null, end_date || null, req.params.id]
  );
  res.json({ success: true });
});

seasonsRouter.delete("/seasons/:id", requireAuth, requireAdmin, async (req, res) => {
  await pool.query("DELETE FROM seasons WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});
