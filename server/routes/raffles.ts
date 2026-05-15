import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin } from "../middleware/roles.ts";

export const rafflesRouter = Router();

async function isSeller(userId: string, raffleId: number) {
  const res = await pool.query("SELECT id FROM raffle_sellers WHERE user_id=$1 AND raffle_id=$2", [userId, raffleId]);
  return res.rows.length > 0;
}

async function generateTicketNumber(raffleId: number): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const num = Math.floor(10000 + Math.random() * 90000).toString();
    const existing = await pool.query("SELECT id FROM raffle_tickets WHERE raffle_id=$1 AND ticket_number=$2", [raffleId, num]);
    if (!existing.rows.length) return num;
  }
  throw new Error("Could not generate unique ticket number");
}

// Admin endpoints
rafflesRouter.get("/raffles", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query(`
    SELECT r.*, (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id=r.id) as ticket_count,
           (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id=r.id AND is_paid=TRUE) as paid_total
    FROM raffles r ORDER BY r.created_at DESC
  `);
  res.json(result.rows);
});

rafflesRouter.get("/raffles/:id", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query(`
    SELECT r.*, (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id=r.id) as ticket_count,
           (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id=r.id AND is_paid=TRUE) as paid_total
    FROM raffles r WHERE r.id=$1
  `, [req.params.id]);
  if (!result.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

rafflesRouter.post("/raffles", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  const result = await pool.query(`
    INSERT INTO raffles (title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING id`,
    [title, description || null, status || "draft", tickets_for_1 || null, tickets_for_5 || null, tickets_for_10 || null, tickets_for_25 || null, tickets_for_50 || null, tickets_for_100 || null, sales_close_at || null, winner_select_at || null]
  );
  res.json({ id: result.rows[0].id });
});

rafflesRouter.put("/raffles/:id", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at } = req.body;
  await pool.query(`
    UPDATE raffles SET title=$1, description=$2, status=$3, tickets_for_1=$4, tickets_for_5=$5, tickets_for_10=$6,
    tickets_for_25=$7, tickets_for_50=$8, tickets_for_100=$9, sales_close_at=$10, winner_select_at=$11, updated_at=NOW() WHERE id=$12`,
    [title, description || null, status || "draft", tickets_for_1 || null, tickets_for_5 || null, tickets_for_10 || null, tickets_for_25 || null, tickets_for_50 || null, tickets_for_100 || null, sales_close_at || null, winner_select_at || null, req.params.id]
  );
  res.json({ success: true });
});

rafflesRouter.get("/raffles/:id/tickets", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string);
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const sellerCheck = await isSeller(req.user!.id, id);
  if (!adminCheck && !sellerCheck) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT * FROM raffle_tickets WHERE raffle_id=$1 ORDER BY created_at DESC", [id]);
  res.json(result.rows);
});

rafflesRouter.patch("/raffle-tickets/:id/paid", requireAuth, async (req, res) => {
  const ticket = await pool.query("SELECT raffle_id FROM raffle_tickets WHERE id=$1", [req.params.id]);
  if (!ticket.rows[0]) { res.status(404).json({ error: "Ticket not found" }); return; }
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const sellerCheck = await isSeller(req.user!.id, ticket.rows[0].raffle_id);
  if (!adminCheck && !sellerCheck) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("UPDATE raffle_tickets SET is_paid=TRUE, updated_at=NOW() WHERE id=$1", [req.params.id]);
  await pool.query(`UPDATE raffles SET total_collected=(SELECT COALESCE(SUM(amount_paid),0) FROM raffle_tickets WHERE raffle_id=$1 AND is_paid=TRUE), updated_at=NOW() WHERE id=$1`, [ticket.rows[0].raffle_id]);
  res.json({ success: true });
});

rafflesRouter.post("/raffles/:id/select-winner", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const tickets = await pool.query("SELECT ticket_number, buyer_name FROM raffle_tickets WHERE raffle_id=$1 AND is_paid=TRUE", [req.params.id]);
  if (!tickets.rows.length) { res.status(400).json({ error: "No paid tickets found" }); return; }
  const winner = tickets.rows[Math.floor(Math.random() * tickets.rows.length)];
  await pool.query("UPDATE raffles SET winning_ticket_number=$1, winner_name=$2, status='completed', updated_at=NOW() WHERE id=$3", [winner.ticket_number, winner.buyer_name, req.params.id]);
  res.json({ winner });
});

rafflesRouter.get("/raffles/:id/sellers", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT * FROM raffle_sellers WHERE raffle_id=$1 ORDER BY created_at DESC", [req.params.id]);
  res.json(result.rows);
});

rafflesRouter.post("/raffles/:id/sellers", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { user_id, user_name, user_email } = req.body;
  if (!user_id) { res.status(400).json({ error: "user_id required" }); return; }
  await pool.query(`INSERT INTO raffle_sellers (raffle_id, user_id, user_name, user_email, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())`, [req.params.id, user_id, user_name || null, user_email || null]);
  res.json({ success: true });
});

rafflesRouter.delete("/raffles/:raffleId/sellers/:sellerId", requireAuth, async (req, res) => {
  if (!(await isAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM raffle_sellers WHERE id=$1", [req.params.sellerId]);
  res.json({ success: true });
});

rafflesRouter.get("/my-raffles", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  let result;
  if (adminCheck) {
    result = await pool.query(`SELECT r.*, (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id=r.id) as ticket_count, (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id=r.id AND is_paid=TRUE) as paid_total FROM raffles r WHERE r.status='open' ORDER BY r.created_at DESC`);
  } else {
    result = await pool.query(`SELECT r.*, (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id=r.id) as ticket_count, (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id=r.id AND is_paid=TRUE) as paid_total FROM raffles r INNER JOIN raffle_sellers rs ON rs.raffle_id=r.id WHERE rs.user_id=$1 AND r.status='open' ORDER BY r.created_at DESC`, [req.user!.id]);
  }
  res.json(result.rows);
});

// Public endpoints
rafflesRouter.get("/raffles-public", async (_req, res) => {
  const result = await pool.query("SELECT id, title, description, status, total_collected FROM raffles WHERE status='open' ORDER BY created_at DESC");
  res.json(result.rows);
});

rafflesRouter.get("/raffles-public/completed", async (_req, res) => {
  const result = await pool.query("SELECT id, title, description, winning_ticket_number, winner_name, total_collected, created_at FROM raffles WHERE status='completed' AND winning_ticket_number IS NOT NULL ORDER BY created_at DESC");
  res.json(result.rows);
});

rafflesRouter.get("/raffles-public/:id", async (req, res) => {
  const result = await pool.query(`SELECT id, title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at, winning_ticket_number, winner_name, total_collected FROM raffles WHERE id=$1 AND status IN ('open','closed','completed')`, [req.params.id]);
  if (!result.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(result.rows[0]);
});

rafflesRouter.get("/raffles-public/:id/tickets", async (req, res) => {
  const result = await pool.query("SELECT ticket_number, buyer_name, quantity, is_paid, created_at FROM raffle_tickets WHERE raffle_id=$1 ORDER BY created_at DESC", [req.params.id]);
  res.json(result.rows);
});

rafflesRouter.post("/raffles-public/:id/purchase", async (req, res) => {
  const id = parseInt(req.params.id as string);
  const { buyer_name, quantity, amount, seller_name } = req.body;
  if (!buyer_name || !quantity || !amount) { res.status(400).json({ error: "buyer_name, quantity, amount required" }); return; }
  const raffle = await pool.query("SELECT * FROM raffles WHERE id=$1 AND status='open'", [id]);
  if (!raffle.rows[0]) { res.status(400).json({ error: "Raffle not available" }); return; }
  if (raffle.rows[0].sales_close_at && new Date(raffle.rows[0].sales_close_at) < new Date()) { res.status(400).json({ error: "Sales have closed" }); return; }
  const ticketNumbers: string[] = [];
  for (let i = 0; i < quantity; i++) {
    const ticketNumber = await generateTicketNumber(id);
    ticketNumbers.push(ticketNumber);
    await pool.query(`INSERT INTO raffle_tickets (raffle_id, ticket_number, buyer_name, quantity, amount_paid, seller_name, created_at, updated_at) VALUES ($1,$2,$3,1,$4,$5,NOW(),NOW())`, [id, ticketNumber, buyer_name, amount / quantity, seller_name || null]);
  }
  res.json({ ticketNumbers, quantity, amount });
});

// Seller endpoints (unauthenticated)
rafflesRouter.get("/seller/raffles/:id", async (req, res) => {
  const raffle = await pool.query(`SELECT id, title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at, total_collected FROM raffles WHERE id=$1`, [req.params.id]);
  if (!raffle.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  const tickets = await pool.query("SELECT id, ticket_number, buyer_name, quantity, amount_paid, is_paid, created_at FROM raffle_tickets WHERE raffle_id=$1 ORDER BY created_at DESC", [req.params.id]);
  res.json({ raffle: raffle.rows[0], tickets: tickets.rows });
});

rafflesRouter.patch("/seller/raffle-tickets/:id/paid", async (req, res) => {
  await pool.query("UPDATE raffle_tickets SET is_paid=TRUE, updated_at=NOW() WHERE id=$1", [req.params.id]);
  const ticket = await pool.query("SELECT raffle_id FROM raffle_tickets WHERE id=$1", [req.params.id]);
  if (ticket.rows[0]) {
    await pool.query(`UPDATE raffles SET total_collected=(SELECT COALESCE(SUM(amount_paid),0) FROM raffle_tickets WHERE raffle_id=$1 AND is_paid=TRUE), updated_at=NOW() WHERE id=$1`, [ticket.rows[0].raffle_id]);
  }
  res.json({ success: true });
});
