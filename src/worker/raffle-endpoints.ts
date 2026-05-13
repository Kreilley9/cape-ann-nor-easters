import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Env } from "@/shared/types";
import { authMiddleware } from "@getmocha/users-service/backend";

async function isAdmin(db: D1Database, userId: string, email: string): Promise<boolean> {
  const adminEmails = ["kevin@capeannnoreasters.com"];
  if (adminEmails.includes(email)) return true;
  const role = await db.prepare("SELECT id FROM user_roles WHERE user_id = ? AND role = 'Admin'").bind(userId).first();
  return !!role;
}

async function isSeller(db: D1Database, userId: string, raffleId: number): Promise<boolean> {
  const seller = await db.prepare(
    "SELECT id FROM raffle_sellers WHERE user_id = ? AND raffle_id = ?"
  ).bind(userId, raffleId).first();
  return !!seller;
}

export function setupRaffleEndpoints(app: Hono<{ Bindings: Env }>) {
  
  // Get all raffles (admin only)
  app.get("/api/portal/raffles", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const raffles = await c.env.DB.prepare(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id = r.id) as ticket_count,
        (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id = r.id AND is_paid = 1) as paid_total
      FROM raffles r
      ORDER BY r.created_at DESC
    `).all();

    return c.json(raffles.results || []);
  });

  // Get single raffle (admin only)
  app.get("/api/portal/raffles/:id", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const raffle = await c.env.DB.prepare(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id = r.id) as ticket_count,
        (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id = r.id AND is_paid = 1) as paid_total
      FROM raffles r
      WHERE r.id = ?
    `).bind(id).first();

    if (!raffle) return c.json({ error: "Not found" }, 404);
    return c.json(raffle);
  });

  const raffleSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.enum(["draft", "open", "closed", "completed"]).optional(),
    tickets_for_1: z.number().optional(),
    tickets_for_5: z.number().optional(),
    tickets_for_10: z.number().optional(),
    tickets_for_25: z.number().optional(),
    tickets_for_50: z.number().optional(),
    tickets_for_100: z.number().optional(),
    sales_close_at: z.string().optional(),
    winner_select_at: z.string().optional(),
  });

  // Create raffle
  app.post("/api/portal/raffles", authMiddleware, zValidator("json", raffleSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const data = c.req.valid("json");
    const now = new Date().toISOString();

    const result = await c.env.DB.prepare(`
      INSERT INTO raffles (title, description, status, tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100, sales_close_at, winner_select_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.title,
      data.description || null,
      data.status || "draft",
      data.tickets_for_1 || null,
      data.tickets_for_5 || null,
      data.tickets_for_10 || null,
      data.tickets_for_25 || null,
      data.tickets_for_50 || null,
      data.tickets_for_100 || null,
      data.sales_close_at || null,
      data.winner_select_at || null,
      now,
      now
    ).run();

    return c.json({ id: result.meta.last_row_id, ...data });
  });

  // Update raffle
  app.put("/api/portal/raffles/:id", authMiddleware, zValidator("json", raffleSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const data = c.req.valid("json");
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE raffles SET 
        title = ?, description = ?, status = ?, 
        tickets_for_1 = ?, tickets_for_5 = ?, tickets_for_10 = ?, tickets_for_25 = ?, tickets_for_50 = ?, tickets_for_100 = ?,
        sales_close_at = ?, winner_select_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      data.title,
      data.description || null,
      data.status || "draft",
      data.tickets_for_1 || null,
      data.tickets_for_5 || null,
      data.tickets_for_10 || null,
      data.tickets_for_25 || null,
      data.tickets_for_50 || null,
      data.tickets_for_100 || null,
      data.sales_close_at || null,
      data.winner_select_at || null,
      now,
      id
    ).run();

    return c.json({ success: true });
  });

  // Get raffle tickets (admin or seller)
  app.get("/api/portal/raffles/:id/tickets", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const id = parseInt(c.req.param("id"));
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    const sellerCheck = await isSeller(c.env.DB, user.id, id);
    
    if (!adminCheck && !sellerCheck) return c.json({ error: "Forbidden" }, 403);

    const tickets = await c.env.DB.prepare(`
      SELECT * FROM raffle_tickets WHERE raffle_id = ? ORDER BY created_at DESC
    `).bind(id).all();

    return c.json(tickets.results || []);
  });

  // Mark ticket as paid (admin or seller)
  app.patch("/api/portal/raffle-tickets/:id/paid", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    // Get ticket to find raffle_id
    const ticketId = c.req.param("id");
    const ticket = await c.env.DB.prepare(`SELECT raffle_id, amount_paid FROM raffle_tickets WHERE id = ?`).bind(ticketId).first();
    if (!ticket) return c.json({ error: "Ticket not found" }, 404);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    const sellerCheck = await isSeller(c.env.DB, user.id, ticket.raffle_id as number);
    
    if (!adminCheck && !sellerCheck) return c.json({ error: "Forbidden" }, 403);

    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE raffle_tickets SET is_paid = 1, updated_at = ? WHERE id = ?
    `).bind(now, ticketId).run();

    // Update raffle total
    await c.env.DB.prepare(`
      UPDATE raffles SET total_collected = (
        SELECT COALESCE(SUM(amount_paid), 0) FROM raffle_tickets WHERE raffle_id = ? AND is_paid = 1
      ), updated_at = ? WHERE id = ?
    `).bind(ticket.raffle_id, now, ticket.raffle_id).run();

    return c.json({ success: true });
  });

  // Select winner (randomizer)
  app.post("/api/portal/raffles/:id/select-winner", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    
    // Get all paid tickets
    const tickets = await c.env.DB.prepare(`
      SELECT ticket_number, buyer_name FROM raffle_tickets WHERE raffle_id = ? AND is_paid = 1
    `).bind(id).all();

    if (!tickets.results || tickets.results.length === 0) {
      return c.json({ error: "No paid tickets found" }, 400);
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * tickets.results.length);
    const winner = tickets.results[randomIndex] as { ticket_number: string; buyer_name: string };
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE raffles SET winning_ticket_number = ?, winner_name = ?, status = 'completed', updated_at = ?
      WHERE id = ?
    `).bind(winner.ticket_number, winner.buyer_name, now, id).run();

    return c.json({ winner });
  });

  // ===== SELLER MANAGEMENT ENDPOINTS =====

  // Get sellers for a raffle
  app.get("/api/portal/raffles/:id/sellers", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const sellers = await c.env.DB.prepare(`
      SELECT * FROM raffle_sellers WHERE raffle_id = ? ORDER BY created_at DESC
    `).bind(id).all();

    return c.json(sellers.results || []);
  });

  // Add seller to raffle
  app.post("/api/portal/raffles/:id/sellers", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const body = await c.req.json();
    const { user_id, user_name, user_email } = body;

    if (!user_id) return c.json({ error: "user_id required" }, 400);

    const now = new Date().toISOString();
    await c.env.DB.prepare(`
      INSERT INTO raffle_sellers (raffle_id, user_id, user_name, user_email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, user_id, user_name || null, user_email || null, now, now).run();

    return c.json({ success: true });
  });

  // Remove seller from raffle
  app.delete("/api/portal/raffles/:raffleId/sellers/:sellerId", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

    const sellerId = c.req.param("sellerId");
    await c.env.DB.prepare("DELETE FROM raffle_sellers WHERE id = ?").bind(sellerId).run();

    return c.json({ success: true });
  });

  // Get raffles where user is a seller (for portal seller page)
  app.get("/api/portal/my-raffles", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    // Check if admin - admins can sell for all raffles
    const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
    
    let raffles;
    if (adminCheck) {
      raffles = await c.env.DB.prepare(`
        SELECT r.*, 
          (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id = r.id) as ticket_count,
          (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id = r.id AND is_paid = 1) as paid_total
        FROM raffles r
        WHERE r.status = 'open'
        ORDER BY r.created_at DESC
      `).all();
    } else {
      raffles = await c.env.DB.prepare(`
        SELECT r.*, 
          (SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id = r.id) as ticket_count,
          (SELECT SUM(amount_paid) FROM raffle_tickets WHERE raffle_id = r.id AND is_paid = 1) as paid_total
        FROM raffles r
        INNER JOIN raffle_sellers rs ON rs.raffle_id = r.id
        WHERE rs.user_id = ? AND r.status = 'open'
        ORDER BY r.created_at DESC
      `).bind(user.id).all();
    }

    return c.json(raffles.results || []);
  });

  // ===== PUBLIC ENDPOINTS =====

  // Get active raffles for support page
  app.get("/api/public/raffles", async (c) => {
    const raffles = await c.env.DB.prepare(`
      SELECT id, title, description, status, total_collected
      FROM raffles WHERE status = 'open'
      ORDER BY created_at DESC
    `).all();

    return c.json(raffles.results || []);
  });

  // Get completed raffles with winners
  app.get("/api/public/raffles/completed", async (c) => {
    const raffles = await c.env.DB.prepare(`
      SELECT id, title, description, winning_ticket_number, winner_name, total_collected, created_at
      FROM raffles WHERE status = 'completed' AND winning_ticket_number IS NOT NULL
      ORDER BY created_at DESC
    `).all();

    return c.json(raffles.results || []);
  });

  // Get public raffle info
  app.get("/api/public/raffles/:id", async (c) => {
    const id = c.req.param("id");
    const raffle = await c.env.DB.prepare(`
      SELECT id, title, description, status, 
        tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100,
        sales_close_at, winner_select_at, winning_ticket_number, winner_name, total_collected
      FROM raffles WHERE id = ? AND status IN ('open', 'closed', 'completed')
    `).bind(id).first();

    if (!raffle) return c.json({ error: "Not found" }, 404);
    return c.json(raffle);
  });

  // Get public ticket list (shows all tickets for a raffle)
  app.get("/api/public/raffles/:id/tickets", async (c) => {
    const id = c.req.param("id");
    const tickets = await c.env.DB.prepare(`
      SELECT ticket_number, buyer_name, quantity, is_paid, created_at
      FROM raffle_tickets WHERE raffle_id = ? ORDER BY created_at DESC
    `).bind(id).all();

    return c.json(tickets.results || []);
  });

  // Generate unique 5-digit ticket number
  async function generateTicketNumber(db: D1Database, raffleId: number): Promise<string> {
    let attempts = 0;
    while (attempts < 100) {
      const num = Math.floor(10000 + Math.random() * 90000).toString();
      const existing = await db.prepare(
        "SELECT id FROM raffle_tickets WHERE raffle_id = ? AND ticket_number = ?"
      ).bind(raffleId, num).first();
      if (!existing) return num;
      attempts++;
    }
    throw new Error("Could not generate unique ticket number");
  }

  const purchaseSchema = z.object({
    buyer_name: z.string().min(1),
    quantity: z.number().int().min(1),
    amount: z.number(),
    seller_name: z.string().optional(),
  });

  // Purchase tickets (public)
  app.post("/api/public/raffles/:id/purchase", zValidator("json", purchaseSchema), async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json");

    // Check raffle is open
    const raffle = await c.env.DB.prepare(
      "SELECT * FROM raffles WHERE id = ? AND status = 'open'"
    ).bind(id).first();

    if (!raffle) {
      return c.json({ error: "Raffle not available" }, 400);
    }

    // Check if sales closed
    if (raffle.sales_close_at) {
      const closeDate = new Date(raffle.sales_close_at as string);
      if (new Date() > closeDate) {
        return c.json({ error: "Sales have closed" }, 400);
      }
    }

    const now = new Date().toISOString();
    const ticketNumbers: string[] = [];

    // Create one ticket record per ticket purchased
    for (let i = 0; i < data.quantity; i++) {
      const ticketNumber = await generateTicketNumber(c.env.DB, id);
      ticketNumbers.push(ticketNumber);
      
      await c.env.DB.prepare(`
        INSERT INTO raffle_tickets (raffle_id, ticket_number, buyer_name, quantity, amount_paid, seller_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, ticketNumber, data.buyer_name, 1, data.amount / data.quantity, data.seller_name || null, now, now).run();
    }

    return c.json({ ticketNumbers, quantity: data.quantity, amount: data.amount });
  });

  // ===== SELLER ENDPOINTS (unauthenticated for external link sharing) =====
  
  // Seller page - get raffle with tickets (requires seller code in URL)
  app.get("/api/seller/raffles/:id", async (c) => {
    const id = c.req.param("id");
    
    const raffle = await c.env.DB.prepare(`
      SELECT id, title, description, status, 
        tickets_for_1, tickets_for_5, tickets_for_10, tickets_for_25, tickets_for_50, tickets_for_100,
        sales_close_at, winner_select_at, total_collected
      FROM raffles WHERE id = ?
    `).bind(id).first();

    if (!raffle) return c.json({ error: "Not found" }, 404);

    const tickets = await c.env.DB.prepare(`
      SELECT id, ticket_number, buyer_name, quantity, amount_paid, is_paid, created_at
      FROM raffle_tickets WHERE raffle_id = ? ORDER BY created_at DESC
    `).bind(id).all();

    return c.json({ raffle, tickets: tickets.results || [] });
  });

  // Seller mark paid (unauthenticated - for external link)
  app.patch("/api/seller/raffle-tickets/:id/paid", async (c) => {
    const id = c.req.param("id");
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE raffle_tickets SET is_paid = 1, updated_at = ? WHERE id = ?
    `).bind(now, id).run();

    // Update raffle total
    const ticket = await c.env.DB.prepare(`SELECT raffle_id, amount_paid FROM raffle_tickets WHERE id = ?`).bind(id).first();
    if (ticket) {
      await c.env.DB.prepare(`
        UPDATE raffles SET total_collected = (
          SELECT COALESCE(SUM(amount_paid), 0) FROM raffle_tickets WHERE raffle_id = ? AND is_paid = 1
        ), updated_at = ? WHERE id = ?
      `).bind(ticket.raffle_id, now, ticket.raffle_id).run();
    }

    return c.json({ success: true });
  });
}
