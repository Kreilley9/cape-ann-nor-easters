import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin, isAdmin } from "../middleware/roles.ts";
import { sendTestSMS } from "../lib/notification-helper.ts";

export const adminRouter = Router();

const ALLOWED_TABLES = [
  "boards", "reservations", "admins", "seasons", "teams", "families", "players",
  "team_players", "events", "attendance", "payments", "event_invites",
  "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
  "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
  "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
  "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
  "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
  "site_config", "user_permissions",
];

adminRouter.get("/admins", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query("SELECT email FROM admins ORDER BY created_at ASC");
  res.json(result.rows);
});

adminRouter.post("/admins", requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "email required" }); return; }
  const existing = await pool.query("SELECT id FROM admins WHERE email = $1", [email]);
  if (existing.rows.length > 0) { res.status(400).json({ error: "Admin already exists" }); return; }
  await pool.query("INSERT INTO admins (email, updated_at) VALUES ($1, NOW())", [email]);
  res.status(201).json({ success: true });
});

adminRouter.get("/admin/tables", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const tableData = await Promise.all(
    ALLOWED_TABLES.map(async (name) => {
      try {
        const r = await pool.query(`SELECT COUNT(*) as count FROM ${name}`);
        return { name, count: Number(r.rows[0].count) };
      } catch { return { name, count: 0 }; }
    })
  );
  res.json({ tables: tableData });
});

adminRouter.get("/admin/tables/:table", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table as string)) { res.status(400).json({ error: "Invalid table name" }); return; }
  const page = parseInt(req.query.page as string || "1");
  const pageSize = parseInt(req.query.pageSize as string || "25");
  const search = (req.query.search as string) || "";
  const offset = (page - 1) * pageSize;

  try {
    const colsResult = await pool.query(
      `SELECT column_name as name, data_type as type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [table]
    );
    const columns = colsResult.rows;

    const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    const total = Number(countResult.rows[0].count);

    let query = `SELECT ${table}.*`;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (table === "players") {
      query += `, families.name as family_name FROM ${table} LEFT JOIN families ON ${table}.family_id = families.id`;
    } else {
      query += ` FROM ${table}`;
    }

    if (search) {
      const textCols = columns.filter((c: { type: string }) => c.type.includes("text") || c.type.includes("character"));
      if (textCols.length > 0) {
        const conditions = textCols.map((c: { name: string }) => { params.push(`%${search}%`); return `${c.name} ILIKE $${paramIdx++}`; });
        query += ` WHERE ${conditions.join(" OR ")}`;
      }
    }

    query += ` ORDER BY id DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(pageSize, offset);

    const result = await pool.query(query, params);
    const additionalCols = table === "players" ? [{ name: "family_name", type: "text" }] : [];
    res.json({ columns: [...columns, ...additionalCols], rows: result.rows, total, page, pageSize });
  } catch (error) {
    console.error("DB admin error:", error);
    res.status(500).json({ error: "Failed to fetch table data" });
  }
});

adminRouter.put("/admin/tables/:table/:id", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table as string)) { res.status(400).json({ error: "Invalid table name" }); return; }
  const body = { ...req.body };
  delete body.id;
  delete body.family_name;
  body.updated_at = new Date().toISOString();
  const keys = Object.keys(body);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => body[k] === "" ? null : body[k]);
  values.push(id);
  try {
    await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update row" });
  }
});

adminRouter.delete("/admin/tables/:table/:id", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { table, id } = req.params;
  if (!ALLOWED_TABLES.includes(table as string)) { res.status(400).json({ error: "Invalid table name" }); return; }
  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete row" });
  }
});

adminRouter.post("/admin/tables/:table", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email!))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table as string)) { res.status(400).json({ error: "Invalid table name" }); return; }
  const body = { ...req.body };
  body.created_at = new Date().toISOString();
  body.updated_at = new Date().toISOString();
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) { if (v !== "") filtered[k] = v; }
  const keys = Object.keys(filtered);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = Object.values(filtered);
  try {
    const result = await pool.query(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) RETURNING id`, values);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create row" });
  }
});

adminRouter.post("/test-sms", requireAuth, requireAdmin, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) { res.status(400).json({ error: "Phone and message required" }); return; }
  try {
    const result = await sendTestSMS(phone, message);
    await pool.query(
      `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, created_at, updated_at)
       VALUES ($1,'test','sms',$2,'success',NOW(),NOW())`,
      [req.user!.id, phone]
    );
    res.json({ success: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await pool.query(
      `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, error_message, created_at, updated_at)
       VALUES ($1,'test','sms',$2,'failed',$3,NOW(),NOW())`,
      [req.user!.id, phone, msg]
    );
    res.status(500).json({ success: false, error: msg });
  }
});
