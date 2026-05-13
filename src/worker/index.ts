import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  getOAuthRedirectUrl,
  exchangeCodeForSessionToken,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import { getCookie, setCookie } from "hono/cookie";
import { setupRoleEndpoints } from "./role-endpoints";
import { setupInviteEndpoints } from "./invite-endpoints";
import { logActivity, getUserDisplayName } from "./activity-logger";
import { sendNotifications } from "./notification-helper";
import { setupActivityEndpoints } from "./activity-endpoints";
import { setupCoachesEndpoints } from "./coaches-endpoints";
import { setupTeamMessageEndpoints } from "./team-message-endpoints";
import { setupNewsEndpoints } from "./news-endpoints";
import { setupGroupMessageEndpoints } from "./group-message-endpoints";
import { setupContactsEndpoints } from "./contacts-endpoints";
import { setupNotificationPreferencesEndpoints } from "./notification-preferences-endpoints";
import { setupPaymentEmailEndpoints } from "./payment-email-endpoints";
import { setupRaffleEndpoints } from "./raffle-endpoints";
import { setupContactEndpoints } from "./contact-endpoints";
import { galleryEndpoints } from "./gallery-endpoints";
import { coachesPublicEndpoints } from "./coaches-public-endpoints";
import { teamsPublicEndpoints } from "./teams-public-endpoints";
import { checkRecruitingAccess, canUploadDocuments, canDownloadDocuments, canManageEvents } from "./permissions-helper";
import { sendTestSMS } from "./notification-helper";
import type { Env } from "@/shared/types";

const app = new Hono<{ Bindings: Env }>();

// Auth endpoints
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });
  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();
  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60,
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Check if user is an admin
  const admin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(user.email).first();
  
  // Get user roles
  const roles = await getUserRoles(c.env.DB, user.id);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  
  return c.json({ 
    ...user, 
    is_admin: !!admin,
    roles: roles,
    family_id: familyId
  });
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Board endpoints
const createBoardSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  team_top: z.string().min(1),
  team_side: z.string().min(1),
  game_date: z.string(),
  cost_per_square: z.number().positive(),
  venmo_handle: z.string().min(1),
  is_open: z.boolean().default(true),
  payout_mode: z.enum(["percent", "fixed"]),
  payouts: z.object({
    q1: z.number(),
    ht: z.number(),
    q3: z.number(),
    final: z.number(),
  }),
  lock_at: z.string(),
});

// Role-based access control helpers
async function getUserRoles(db: D1Database, userId: string) {
  const { results } = await db.prepare(
    "SELECT role, team_id, family_id FROM user_roles WHERE user_id = ?"
  ).bind(userId).all();
  return results as Array<{ role: string; team_id: number | null; family_id: number | null }>;
}

async function hasRole(db: D1Database, userId: string, role: string) {
  const roles = await getUserRoles(db, userId);
  return roles.some(r => r.role === role);
}

async function isAdmin(db: D1Database, userId: string, email: string) {
  const admin = await db.prepare("SELECT id FROM admins WHERE email = ?").bind(email).first();
  if (admin) return true;
  return hasRole(db, userId, 'admin');
}

async function getFamilyIdForUser(db: D1Database, userId: string) {
  const roles = await getUserRoles(db, userId);
  const parentRole = roles.find(r => r.role === 'parent');
  if (parentRole?.family_id) return parentRole.family_id;
  
  // Also check families table
  const family = await db.prepare("SELECT id FROM families WHERE user_id = ?").bind(userId).first();
  return family ? (family.id as number) : null;
}

// Role check middleware
const requireAdmin = async (c: any, next: any) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden - Admin access required" }, 403);
  }
  
  await next();
};

// Admin check middleware
const adminMiddleware: any = async (c: any, next: any) => {
  const user = c.get("user");
  if (!user || !user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const admin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(user.email).first();
  
  if (!admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  
  await next();
};

app.post("/api/boards", authMiddleware, adminMiddleware, zValidator("json", createBoardSchema), async (c) => {
  const data = c.req.valid("json");
  
  const existing = await c.env.DB.prepare(
    "SELECT id FROM boards WHERE slug = ?"
  ).bind(data.slug).first();
  
  if (existing) {
    return c.json({ error: "Board with this slug already exists" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO boards (slug, title, team_top, team_side, game_date, cost_per_square, 
     venmo_handle, is_open, payout_mode, payouts, lock_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    data.slug,
    data.title,
    data.team_top,
    data.team_side,
    data.game_date,
    data.cost_per_square,
    data.venmo_handle,
    data.is_open ? 1 : 0,
    data.payout_mode,
    JSON.stringify(data.payouts),
    data.lock_at
  ).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

app.get("/api/boards", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM boards ORDER BY created_at DESC"
  ).all();

  return c.json(results.map((board: any) => ({
    ...board,
    payouts: JSON.parse(board.payouts as string),
    scores: board.scores ? JSON.parse(board.scores as string) : null,
    top_nums: board.top_nums ? JSON.parse(board.top_nums as string) : null,
    side_nums: board.side_nums ? JSON.parse(board.side_nums as string) : null,
    is_open: !!board.is_open,
  })));
});

app.get("/api/boards/:slug", async (c) => {
  const slug = c.req.param("slug");
  const board = await c.env.DB.prepare(
    "SELECT * FROM boards WHERE slug = ?"
  ).bind(slug).first();

  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }

  return c.json({
    ...board,
    payouts: JSON.parse(board.payouts as string),
    scores: board.scores ? JSON.parse(board.scores as string) : null,
    top_nums: board.top_nums ? JSON.parse(board.top_nums as string) : null,
    side_nums: board.side_nums ? JSON.parse(board.side_nums as string) : null,
    is_open: !!board.is_open,
  });
});

const updateBoardSchema = z.object({
  title: z.string().min(1).optional(),
  team_top: z.string().min(1).optional(),
  team_side: z.string().min(1).optional(),
  game_date: z.string().optional(),
  cost_per_square: z.number().positive().optional(),
  venmo_handle: z.string().min(1).optional(),
  is_open: z.boolean().optional(),
  payout_mode: z.enum(["percent", "fixed"]).optional(),
  payouts: z.object({
    q1: z.number(),
    ht: z.number(),
    q3: z.number(),
    final: z.number(),
  }).optional(),
  lock_at: z.string().optional(),
});

app.patch("/api/boards/:id", authMiddleware, adminMiddleware, zValidator("json", updateBoardSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key === "payouts") {
      updates.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else if (key === "is_open") {
      updates.push(`${key} = ?`);
      values.push(value ? 1 : 0);
    } else {
      updates.push(`${key} = ?`);
      values.push(value);
    }
  });

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE boards SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ success: true });
});

app.delete("/api/boards/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  
  await c.env.DB.prepare("DELETE FROM reservations WHERE board_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM boards WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

app.post("/api/boards/:id/randomize", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  
  const board = await c.env.DB.prepare(
    "SELECT * FROM boards WHERE id = ?"
  ).bind(id).first();

  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (board.randomized_at) {
    return c.json({ error: "Board already randomized" }, 400);
  }

  const { results: reservations } = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM reservations WHERE board_id = ?"
  ).bind(id).all();

  const count = (reservations[0] as { count: number }).count;
  if (count < 100) {
    return c.json({ error: "Board must be full (100/100) before randomizing" }, 400);
  }

  const topNums = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const sideNums = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  await c.env.DB.prepare(
    `UPDATE boards SET top_nums = ?, side_nums = ?, randomized_at = CURRENT_TIMESTAMP, 
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(JSON.stringify(topNums), JSON.stringify(sideNums), id).run();

  return c.json({ topNums, sideNums });
});

const updateScoresSchema = z.object({
  q1: z.object({ top: z.number(), side: z.number() }).optional(),
  ht: z.object({ top: z.number(), side: z.number() }).optional(),
  q3: z.object({ top: z.number(), side: z.number() }).optional(),
  final: z.object({ top: z.number(), side: z.number() }).optional(),
});

app.patch("/api/boards/:id/scores", authMiddleware, adminMiddleware, zValidator("json", updateScoresSchema), async (c) => {
  const id = c.req.param("id");
  const scores = c.req.valid("json");

  await c.env.DB.prepare(
    "UPDATE boards SET scores = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(JSON.stringify(scores), id).run();

  return c.json({ success: true });
});

// Reservation endpoints
const createReservationSchema = z.object({
  board_id: z.number(),
  square_idx: z.number().min(1).max(100),
  buyer_name: z.string().min(1),
  email: z.string().email(),
  venmo_handle: z.string().optional(),
});

app.post("/api/reservations", zValidator("json", createReservationSchema), async (c) => {
  const data = c.req.valid("json");

  const board = await c.env.DB.prepare(
    "SELECT is_open FROM boards WHERE id = ?"
  ).bind(data.board_id).first();

  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }

  if (!board.is_open) {
    return c.json({ error: "Board is closed" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM reservations WHERE board_id = ? AND square_idx = ?"
  ).bind(data.board_id, data.square_idx - 1).first();

  if (existing) {
    return c.json({ error: "Square already reserved" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO reservations (board_id, square_idx, buyer_name, email, venmo_handle, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(data.board_id, data.square_idx - 1, data.buyer_name, data.email, data.venmo_handle || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

app.get("/api/reservations", authMiddleware, adminMiddleware, async (c) => {
  const boardId = c.req.query("board_id");
  
  if (!boardId) {
    return c.json({ error: "board_id query parameter required" }, 400);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM reservations WHERE board_id = ? ORDER BY square_idx ASC"
  ).bind(boardId).all();

  return c.json(results);
});

app.get("/api/boards/:slug/reservations", async (c) => {
  const slug = c.req.param("slug");
  
  const board = await c.env.DB.prepare(
    "SELECT id FROM boards WHERE slug = ?"
  ).bind(slug).first();

  if (!board) {
    return c.json({ error: "Board not found" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT square_idx, buyer_name, email, status FROM reservations WHERE board_id = ?"
  ).bind(board.id).all();

  return c.json(results);
});

app.patch("/api/reservations/:id/paid", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(
    "UPDATE reservations SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

const updateReservationSchema = z.object({
  buyer_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  venmo_handle: z.string().optional(),
});

app.patch("/api/reservations/:id", authMiddleware, adminMiddleware, zValidator("json", updateReservationSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    updates.push(`${key} = ?`);
    values.push(value === "" ? null : value);
  });

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE reservations SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ success: true });
});

app.delete("/api/reservations/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");

  await c.env.DB.prepare(
    "DELETE FROM reservations WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

// Admin endpoints
app.get("/api/admins", authMiddleware, adminMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT email FROM admins ORDER BY created_at ASC"
  ).all();

  return c.json(results);
});

const createAdminSchema = z.object({
  email: z.string().email(),
});

app.post("/api/admins", authMiddleware, adminMiddleware, zValidator("json", createAdminSchema), async (c) => {
  const data = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(data.email).first();

  if (existing) {
    return c.json({ error: "Admin already exists" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT INTO admins (email, updated_at) VALUES (?, CURRENT_TIMESTAMP)"
  ).bind(data.email).run();

  return c.json({ success: true }, 201);
});

function shuffle(array: number[]): number[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================
// Portal API endpoints
// ============================================

// Check if user is admin
app.get("/api/portal/admin-check", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.email) {
    return c.json({ isAdmin: false });
  }
  
  const admin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(user.email).first();
  
  return c.json({ isAdmin: !!admin });
});

// Public events endpoint (no auth required)
app.get("/api/public/events", async (c) => {
  try {
    const events = await c.env.DB.prepare(
      `SELECT 
        e.id,
        e.team_id,
        e.event_type,
        e.title,
        e.description,
        e.location,
        e.start_at,
        e.end_at,
        e.is_cancelled,
        e.cost,
        t.name as team_name
       FROM events e
       LEFT JOIN teams t ON e.team_id = t.id
       WHERE e.start_at >= datetime('now') AND e.event_type = 'tournament'
       ORDER BY e.start_at ASC
       LIMIT 100`
    ).all();
    
    return c.json(events.results || []);
  } catch (error) {
    console.error("Error fetching public events:", error);
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

// Public tryout request form
app.post("/api/public/request-tryout", async (c) => {
  try {
    const body = await c.req.json();
    const {
      playerName,
      parentName,
      email,
      phone,
      preferredContact,
      birthYear,
      flagExperience,
      tournamentExperience,
      primaryGoal,
      coachingInterest,
      additionalComments
    } = body;

    // Validate required fields
    if (!playerName || !parentName || !email || !phone || !preferredContact || !birthYear || !flagExperience || !tournamentExperience) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Split player name into first/last
    const nameParts = playerName.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Build notes with all the extra info
    const notesLines = [];
    notesLines.push(`Preferred Contact: ${preferredContact}`);
    notesLines.push(`Flag Football Experience: ${flagExperience} years`);
    notesLines.push(`Tournament Experience: ${tournamentExperience} years`);
    if (primaryGoal) notesLines.push(`Primary Goal: ${primaryGoal}`);
    if (coachingInterest) notesLines.push(`Coaching/Volunteering Interest: ${coachingInterest}`);
    if (additionalComments) notesLines.push(`Additional Comments: ${additionalComments}`);
    const notes = notesLines.join("\n");

    // Create birth date from year (Jan 1 of that year)
    const birthDate = `${birthYear}-01-01`;

    // Insert into prospects table
    const result = await c.env.DB.prepare(
      `INSERT INTO prospects (
        first_name, last_name, birth_date, parent_name, parent_email, parent_phone,
        status, interest_level, source, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      firstName,
      lastName,
      birthDate,
      parentName,
      email,
      phone,
      "New",
      "High",
      "Website Tryout Request",
      notes
    ).run();

    const prospectId = result.meta?.last_row_id;

    // Send email notification (only in production - detect by checking host)
    const host = c.req.header("host") || "";
    const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
    console.log("Tryout request host:", host, "isProduction:", isProduction);
    
    if (isProduction) {
      console.log("Attempting to send tryout request email to kevin@capeannnoreasters.com");
      
      const emailHtml = `
        <h2>New Tryout Request</h2>
        <p><strong>Player Name:</strong> ${playerName}</p>
        <p><strong>Parent Name:</strong> ${parentName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Preferred Contact:</strong> ${preferredContact}</p>
        <p><strong>Birth Year:</strong> ${birthYear}</p>
        <p><strong>Flag Football Experience:</strong> ${flagExperience} years</p>
        <p><strong>Tournament Experience:</strong> ${tournamentExperience} years</p>
        ${primaryGoal ? `<p><strong>Primary Goal:</strong></p><p>${primaryGoal.replace(/\n/g, '<br>')}</p>` : ''}
        ${coachingInterest ? `<p><strong>Coaching/Volunteering Interest:</strong> ${coachingInterest}</p>` : ''}
        ${additionalComments ? `<p><strong>Additional Comments:</strong></p><p>${additionalComments.replace(/\n/g, '<br>')}</p>` : ''}
      `;

      const emailText = `
New Tryout Request

Player Name: ${playerName}
Parent Name: ${parentName}
Email: ${email}
Phone: ${phone}
Preferred Contact: ${preferredContact}
Birth Year: ${birthYear}
Flag Football Experience: ${flagExperience} years
Tournament Experience: ${tournamentExperience} years
${primaryGoal ? `\nPrimary Goal:\n${primaryGoal}` : ''}
${coachingInterest ? `\nCoaching/Volunteering Interest: ${coachingInterest}` : ''}
${additionalComments ? `\nAdditional Comments:\n${additionalComments}` : ''}
      `;

      try {
        const emailResult = await c.env.EMAILS.send({
          to: "kevin@capeannnoreasters.com",
          subject: `Tryout Request: ${playerName}`,
          html_body: emailHtml,
          text_body: emailText,
        });
        console.log("Email send result:", emailResult);
      } catch (emailError) {
        console.error("Error sending tryout request email:", emailError);
        // Don't throw - we still want to return success since the prospect was saved
      }
    } else {
      console.log("Skipping email send in development (host:", host, ")");
    }

    return c.json({ success: true, prospectId });
  } catch (error) {
    console.error("Error processing tryout request:", error);
    return c.json({ error: "Failed to submit tryout request" }, 500);
  }
});

// Portal stats
app.get("/api/portal/stats", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const roles = await getUserRoles(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'coach' && r.team_id).map(r => r.team_id);
  const isCoach = coachTeamIds.length > 0;
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const isParent = !adminCheck && !isCoach && familyId;

  let stats = {
    totalTeams: 0,
    totalPlayers: 0,
    upcomingEvents: 0,
    pendingPayments: 0,
    totalRecruits: 0,
    pendingUniformOrders: 0,
    activeSurveys: 0,
    totalDocuments: 0,
    unreadMessages: 0,
  };

  if (adminCheck) {
    // Admins see all stats
    const teamsResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM teams").first() as { count: number } | null;
    const playersResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM players").first() as { count: number } | null;
    const eventsResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM events WHERE start_at > datetime('now')"
    ).first() as { count: number } | null;
    const paymentsResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM payments WHERE status = 'pending'"
    ).first() as { count: number } | null;
    const prospectsResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM prospects").first() as { count: number } | null;
    const uniformOrdersResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM uniform_orders WHERE status = 'pending'"
    ).first() as { count: number } | null;
    const surveysResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM surveys WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).first() as { count: number } | null;
    const documentsResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM team_documents"
    ).first() as { count: number } | null;

    stats = {
      totalTeams: Number(teamsResult?.count) || 0,
      totalPlayers: Number(playersResult?.count) || 0,
      upcomingEvents: Number(eventsResult?.count) || 0,
      pendingPayments: Number(paymentsResult?.count) || 0,
      totalRecruits: Number(prospectsResult?.count) || 0,
      pendingUniformOrders: Number(uniformOrdersResult?.count) || 0,
      activeSurveys: Number(surveysResult?.count) || 0,
      totalDocuments: Number(documentsResult?.count) || 0,
      unreadMessages: 0,
    };
  } else if (isCoach) {
    // Coaches see stats for their teams
    const placeholders = coachTeamIds.map(() => '?').join(',');
    
    const teamsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM teams WHERE id IN (${placeholders})`
    ).bind(...coachTeamIds).first() as { count: number } | null;
    
    const playersResult = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT p.id) as count 
       FROM players p 
       JOIN team_players tp ON p.id = tp.player_id 
       WHERE tp.team_id IN (${placeholders})`
    ).bind(...coachTeamIds).first() as { count: number } | null;
    
    const eventsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM events 
       WHERE team_id IN (${placeholders}) 
       AND start_at > datetime('now')`
    ).bind(...coachTeamIds).first() as { count: number } | null;
    
    const paymentsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM payments 
       WHERE team_id IN (${placeholders}) 
       AND status = 'pending'`
    ).bind(...coachTeamIds).first() as { count: number } | null;
    
    // Coaches see recruiting stats
    const prospectsResult = await c.env.DB.prepare("SELECT COUNT(*) as count FROM prospects").first() as { count: number } | null;
    
    const uniformOrdersResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM uniform_orders 
       WHERE team_id IN (${placeholders}) 
       AND status = 'pending'`
    ).bind(...coachTeamIds).first() as { count: number } | null;
    
    const surveysResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM surveys WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).first() as { count: number } | null;
    const documentsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM team_documents WHERE team_id IN (${placeholders})`
    ).bind(...coachTeamIds).first() as { count: number } | null;

    stats = {
      totalTeams: Number(teamsResult?.count) || 0,
      totalPlayers: Number(playersResult?.count) || 0,
      upcomingEvents: Number(eventsResult?.count) || 0,
      pendingPayments: Number(paymentsResult?.count) || 0,
      totalRecruits: Number(prospectsResult?.count) || 0,
      pendingUniformOrders: Number(uniformOrdersResult?.count) || 0,
      activeSurveys: Number(surveysResult?.count) || 0,
      totalDocuments: Number(documentsResult?.count) || 0,
      unreadMessages: 0,
    };
  } else if (isParent && familyId) {
    // Parents see stats for their family only
    const playersResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM players WHERE family_id = ?`
    ).bind(familyId).first() as { count: number } | null;
    
    const eventsResult = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT e.id) as count 
       FROM events e 
       JOIN event_invites ei ON e.id = ei.event_id 
       JOIN players p ON ei.player_id = p.id 
       WHERE p.family_id = ? 
       AND e.start_at > datetime('now')`
    ).bind(familyId).first() as { count: number } | null;
    
    const paymentsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM player_payments pp 
       JOIN players p ON pp.player_id = p.id 
       WHERE p.family_id = ? 
       AND pp.status = 'unpaid'`
    ).bind(familyId).first() as { count: number } | null;
    
    const uniformOrdersResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count 
       FROM uniform_orders uo 
       JOIN players p ON uo.player_id = p.id 
       WHERE p.family_id = ? 
       AND uo.status = 'pending'`
    ).bind(familyId).first() as { count: number } | null;
    
    const surveysResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM surveys WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))"
    ).first() as { count: number } | null;
    const documentsResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM team_documents WHERE family_id = ?`
    ).bind(familyId).first() as { count: number } | null;

    stats = {
      totalTeams: 0, // Parents don't need team count
      totalPlayers: Number(playersResult?.count) || 0,
      upcomingEvents: Number(eventsResult?.count) || 0,
      pendingPayments: Number(paymentsResult?.count) || 0,
      totalRecruits: 0, // Parents don't see recruiting
      pendingUniformOrders: Number(uniformOrdersResult?.count) || 0,
      activeSurveys: Number(surveysResult?.count) || 0,
      totalDocuments: Number(documentsResult?.count) || 0,
      unreadMessages: 0,
    };
  }

  return c.json(stats);
});

// Family Dashboard endpoint - detailed data for family view
app.get("/api/portal/family-dashboard", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  if (!familyId) {
    return c.json({ error: "No family associated with this account" }, 400);
  }

  // Get children with their teams
  const children = await c.env.DB.prepare(`
    SELECT p.id, p.first_name, p.last_name, p.birth_date, p.jersey_number, p.photo_key,
           GROUP_CONCAT(DISTINCT t.name) as team_names
    FROM players p
    LEFT JOIN team_players tp ON p.id = tp.player_id
    LEFT JOIN teams t ON tp.team_id = t.id
    WHERE p.family_id = ?
    GROUP BY p.id
    ORDER BY p.first_name
  `).bind(familyId).all();

  // Get pending payments/dues
  const pendingPayments = await c.env.DB.prepare(`
    SELECT pp.id, pp.amount, pp.status, pp.due_date, pay.description,
           p.first_name, p.last_name, p.id as player_id,
           t.name as team_name
    FROM player_payments pp
    JOIN payments pay ON pp.payment_id = pay.id
    JOIN players p ON pp.player_id = p.id
    LEFT JOIN teams t ON pay.team_id = t.id
    WHERE p.family_id = ? AND pp.status = 'unpaid'
    ORDER BY pp.due_date ASC
  `).bind(familyId).all();

  // Get pending RSVPs (events needing response)
  const pendingRsvps = await c.env.DB.prepare(`
    SELECT DISTINCT e.id, e.title, e.event_type, e.start_at, e.location,
           t.name as team_name, p.first_name, p.last_name, p.id as player_id
    FROM events e
    JOIN event_invites ei ON e.id = ei.event_id
    JOIN players p ON ei.player_id = p.id
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN attendance a ON a.event_id = e.id AND a.player_id = p.id
    WHERE p.family_id = ?
      AND e.start_at > datetime('now')
      AND a.id IS NULL
    ORDER BY e.start_at ASC
    LIMIT 10
  `).bind(familyId).all();

  // Get upcoming events (next 7 days)
  const upcomingEvents = await c.env.DB.prepare(`
    SELECT DISTINCT e.id, e.title, e.event_type, e.start_at, e.end_at, e.location,
           t.name as team_name,
           (SELECT GROUP_CONCAT(p2.first_name) FROM event_invites ei2 
            JOIN players p2 ON ei2.player_id = p2.id 
            WHERE ei2.event_id = e.id AND p2.family_id = ?) as invited_children
    FROM events e
    JOIN event_invites ei ON e.id = ei.event_id
    JOIN players p ON ei.player_id = p.id
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE p.family_id = ?
      AND e.start_at > datetime('now')
      AND e.start_at < datetime('now', '+7 days')
    ORDER BY e.start_at ASC
    LIMIT 10
  `).bind(familyId, familyId).all();

  // Get active surveys
  const activeSurveys = await c.env.DB.prepare(`
    SELECT s.id, s.title, s.description, s.expires_at,
           (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id = s.id AND sr.user_id = ?) as has_responded
    FROM surveys s
    WHERE s.is_active = 1 
      AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
    ORDER BY s.created_at DESC
  `).bind(user.id).all();

  // Get recent documents
  const recentDocuments = await c.env.DB.prepare(`
    SELECT td.id, td.title, td.file_key, td.created_at, t.name as team_name
    FROM team_documents td
    LEFT JOIN teams t ON td.team_id = t.id
    LEFT JOIN team_players tp ON t.id = tp.team_id
    LEFT JOIN players p ON tp.player_id = p.id
    WHERE p.family_id = ?
    GROUP BY td.id
    ORDER BY td.created_at DESC
    LIMIT 5
  `).bind(familyId).all();

  // Get family info
  const family = await c.env.DB.prepare(`
    SELECT id, family_name, parent1_first_name, parent1_last_name
    FROM families WHERE id = ?
  `).bind(familyId).first();

  return c.json({
    family,
    children: children.results || [],
    pendingPayments: pendingPayments.results || [],
    pendingRsvps: pendingRsvps.results || [],
    upcomingEvents: upcomingEvents.results || [],
    activeSurveys: (activeSurveys.results || []).filter((s: any) => s.has_responded === 0),
    recentDocuments: recentDocuments.results || [],
  });
});

// Tryout Config endpoints
app.get("/api/portal/tryout-config", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  const config = await c.env.DB.prepare(
    "SELECT * FROM tryout_config ORDER BY id DESC LIMIT 1"
  ).first();

  return c.json(config);
});

const tryoutConfigSchema = z.object({
  is_enabled: z.boolean(),
  tryout_date: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

app.put("/api/portal/tryout-config", authMiddleware, zValidator("json", tryoutConfigSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  const data = c.req.valid("json");
  const now = new Date().toISOString();

  // Check if config exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM tryout_config ORDER BY id DESC LIMIT 1"
  ).first();

  if (existing) {
    // Update existing
    await c.env.DB.prepare(
      `UPDATE tryout_config 
       SET is_enabled = ?, tryout_date = ?, title = ?, description = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      data.is_enabled ? 1 : 0,
      data.tryout_date || null,
      data.title || null,
      data.description || null,
      now,
      (existing as any).id
    ).run();
  } else {
    // Create new
    await c.env.DB.prepare(
      `INSERT INTO tryout_config (is_enabled, tryout_date, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      data.is_enabled ? 1 : 0,
      data.tryout_date || null,
      data.title || null,
      data.description || null,
      now,
      now
    ).run();
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'updated',
    entityType: 'tryout_config',
    entityName: 'Tryout Configuration'
  });

  return c.json({ success: true });
});

// Public endpoint to get tryout config
app.get("/api/public/tryout-config", async (c) => {
  const config = await c.env.DB.prepare(
    "SELECT * FROM tryout_config WHERE is_enabled = 1 ORDER BY id DESC LIMIT 1"
  ).first();

  return c.json(config);
});

// Site Config endpoints (banner, etc.)
app.get("/api/portal/site-config", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  const configs = await c.env.DB.prepare(
    "SELECT config_key, config_value FROM site_config"
  ).all();

  const result: Record<string, string> = {};
  for (const row of configs.results || []) {
    result[(row as any).config_key] = (row as any).config_value || "";
  }

  return c.json(result);
});

const bannerConfigSchema = z.object({
  enabled: z.boolean(),
  text: z.string(),
  link: z.string(),
  type: z.string(),
});

app.put("/api/portal/site-config/banner", authMiddleware, zValidator("json", bannerConfigSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden - Admin only" }, 403);
  }

  const data = c.req.valid("json");
  const now = new Date().toISOString();

  // Update each config value
  await c.env.DB.prepare(
    "UPDATE site_config SET config_value = ?, updated_at = ? WHERE config_key = ?"
  ).bind(data.enabled ? "1" : "0", now, "banner_enabled").run();

  await c.env.DB.prepare(
    "UPDATE site_config SET config_value = ?, updated_at = ? WHERE config_key = ?"
  ).bind(data.text, now, "banner_text").run();

  await c.env.DB.prepare(
    "UPDATE site_config SET config_value = ?, updated_at = ? WHERE config_key = ?"
  ).bind(data.link, now, "banner_link").run();

  await c.env.DB.prepare(
    "UPDATE site_config SET config_value = ?, updated_at = ? WHERE config_key = ?"
  ).bind(data.type, now, "banner_type").run();

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'updated',
    entityType: 'site_config',
    entityName: 'Homepage Banner'
  });

  return c.json({ success: true });
});

// User Permissions endpoints
app.get("/api/portal/user-permissions/:userId", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

  const userId = c.req.param("userId");
  
  const permissions = await c.env.DB.prepare(
    "SELECT permission_key, permission_value FROM user_permissions WHERE user_id = ?"
  ).bind(userId).all();

  const result: Record<string, string> = {};
  for (const row of permissions.results || []) {
    result[(row as any).permission_key] = (row as any).permission_value || "";
  }

  return c.json(result);
});

const userPermissionsSchema = z.object({
  recruiting_access: z.string(),
  recruiting_age_groups: z.string(),
  messaging_send: z.string(),
  documents_upload: z.string(),
  documents_download: z.string(),
  events_manage: z.string(),
});

app.put("/api/portal/user-permissions/:userId", authMiddleware, zValidator("json", userPermissionsSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) return c.json({ error: "Forbidden" }, 403);

  const userId = c.req.param("userId");
  const data = c.req.valid("json");
  const now = new Date().toISOString();

  // Upsert each permission
  const permissionKeys = [
    "recruiting_access",
    "recruiting_age_groups", 
    "messaging_send",
    "documents_upload",
    "documents_download",
    "events_manage"
  ];

  for (const key of permissionKeys) {
    const value = data[key as keyof typeof data];
    
    // Check if permission exists
    const existing = await c.env.DB.prepare(
      "SELECT id FROM user_permissions WHERE user_id = ? AND permission_key = ?"
    ).bind(userId, key).first();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE user_permissions SET permission_value = ?, updated_at = ? WHERE user_id = ? AND permission_key = ?"
      ).bind(value, now, userId, key).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO user_permissions (user_id, permission_key, permission_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(userId, key, value, now, now).run();
    }
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'updated',
    entityType: 'user_permissions',
    entityName: 'User Permissions'
  });

  return c.json({ success: true });
});

// Public endpoint to get banner config
app.get("/api/public/site-config/banner", async (c) => {
  const configs = await c.env.DB.prepare(
    "SELECT config_key, config_value FROM site_config WHERE config_key LIKE 'banner_%'"
  ).all();

  const result: Record<string, string> = {};
  for (const row of configs.results || []) {
    result[(row as any).config_key] = (row as any).config_value || "";
  }

  // Only return if enabled
  if (result.banner_enabled !== "1") {
    return c.json(null);
  }

  return c.json({
    text: result.banner_text || "",
    link: result.banner_link || "",
    type: result.banner_type || "info"
  });
});

// Public tryout signup endpoint
const tryoutSignupSchema = z.object({
  playerName: z.string(),
  parentName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  preferredContact: z.string().optional(),
  birthYear: z.string(),
  flagExperience: z.string().optional(),
  tournamentExperience: z.string().optional(),
  primaryGoal: z.string().optional(),
  coachingInterest: z.string().optional(),
  additionalComments: z.string().optional(),
});

app.post("/api/public/tryout-signup", zValidator("json", tryoutSignupSchema), async (c) => {
  const data = c.req.valid("json");
  const now = new Date().toISOString();

  // Parse player name
  const nameParts = data.playerName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Calculate birth_date from birth year
  const birthDate = data.birthYear ? `${data.birthYear}-01-01` : null;

  // Build notes from form data
  const notes = [
    data.flagExperience ? `Flag Experience: ${data.flagExperience} years` : null,
    data.tournamentExperience ? `Tournament Experience: ${data.tournamentExperience} years` : null,
    data.primaryGoal ? `Goal: ${data.primaryGoal}` : null,
    data.coachingInterest ? `Coaching Interest: ${data.coachingInterest}` : null,
    data.additionalComments ? `Comments: ${data.additionalComments}` : null,
    data.preferredContact ? `Preferred Contact: ${data.preferredContact}` : null,
  ].filter(Boolean).join('\n');

  // Insert prospect
  const result = await c.env.DB.prepare(
    `INSERT INTO prospects (
      first_name, last_name, birth_date, email, phone,
      parent_name, parent_email, parent_phone,
      status, interest_level, source, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    firstName,
    lastName,
    birthDate,
    data.email,
    data.phone,
    data.parentName,
    data.email,
    data.phone,
    'New',
    'High',
    'Tryout Sign Up',
    notes,
    now,
    now
  ).run();

  // Send email notification in production only - detect by checking host
  const host = c.req.header("host") || "";
  const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
  
  if (isProduction) {
    try {
      await c.env.EMAILS.send({
        to: "kevin@capeannnoreasters.com",
        subject: `New Tryout Sign Up: ${data.playerName}`,
        html_body: `
          <h2>New Tryout Sign Up</h2>
          <p><strong>Player:</strong> ${data.playerName}</p>
          <p><strong>Parent:</strong> ${data.parentName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>Birth Year:</strong> ${data.birthYear}</p>
          ${data.flagExperience ? `<p><strong>Flag Experience:</strong> ${data.flagExperience} years</p>` : ''}
          ${data.tournamentExperience ? `<p><strong>Tournament Experience:</strong> ${data.tournamentExperience} years</p>` : ''}
          ${data.primaryGoal ? `<p><strong>Goal:</strong> ${data.primaryGoal}</p>` : ''}
          ${data.coachingInterest ? `<p><strong>Coaching Interest:</strong> ${data.coachingInterest}</p>` : ''}
          ${data.additionalComments ? `<p><strong>Comments:</strong> ${data.additionalComments}</p>` : ''}
        `,
        text_body: `New Tryout Sign Up\n\nPlayer: ${data.playerName}\nParent: ${data.parentName}\nEmail: ${data.email}\nPhone: ${data.phone}\nBirth Year: ${data.birthYear}`
      });
      console.log("Tryout signup email sent successfully");
    } catch (error) {
      console.error('Failed to send tryout signup email:', error);
    }
  } else {
    console.log("Skipping tryout signup email in development (host:", host, ")");
  }

  return c.json({ success: true, id: result.meta.last_row_id });
});

// Seasons endpoints
app.get("/api/portal/seasons", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM seasons ORDER BY year DESC, name ASC"
  ).all();
  return c.json(results);
});

const createSeasonSchema = z.object({
  name: z.string().min(1),
  year: z.number(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

app.post("/api/portal/seasons", authMiddleware, adminMiddleware, zValidator("json", createSeasonSchema), async (c) => {
  const data = c.req.valid("json");
  
  const result = await c.env.DB.prepare(
    `INSERT INTO seasons (name, year, start_date, end_date, is_active, updated_at) 
     VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
  ).bind(data.name, data.year, data.start_date || null, data.end_date || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

app.patch("/api/portal/seasons/:id/activate", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  
  // Deactivate all seasons first
  await c.env.DB.prepare("UPDATE seasons SET is_active = 0, updated_at = CURRENT_TIMESTAMP").run();
  
  // Activate the selected one
  await c.env.DB.prepare(
    "UPDATE seasons SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

// Teams endpoints - get all teams
app.get("/api/portal/teams", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT 
      t.*,
      (SELECT COUNT(*) FROM team_players WHERE team_id = t.id AND is_active = 1) as player_count
    FROM teams t
    ORDER BY t.name ASC
  `).all();

  return c.json(results);
});

// Get teams for a specific season
app.get("/api/portal/seasons/:seasonId/teams", authMiddleware, async (c) => {
  const seasonId = c.req.param("seasonId");
  
  const { results } = await c.env.DB.prepare(`
    SELECT 
      t.*,
      ts.division,
      (SELECT COUNT(*) FROM team_players WHERE team_id = t.id AND is_active = 1) as player_count
    FROM teams t
    JOIN team_seasons ts ON t.id = ts.team_id
    WHERE ts.season_id = ?
    ORDER BY t.age_group ASC, t.name ASC
  `).bind(seasonId).all();

  return c.json(results);
});

const createTeamSchema = z.object({
  name: z.string().min(1),
  age_group: z.string().optional(),
  head_coach_user_id: z.string().optional(),
  assistant_coach_user_id: z.string().optional(),
});

app.post("/api/portal/teams", authMiddleware, adminMiddleware, zValidator("json", createTeamSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  
  // Use season_id = 1 as default for compatibility with database constraint
  const result = await c.env.DB.prepare(
    `INSERT INTO teams (name, age_group, head_coach_user_id, assistant_coach_user_id, season_id, updated_at) 
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
  ).bind(data.name, data.age_group || null, data.head_coach_user_id || null, data.assistant_coach_user_id || null).run();

  if (user) {
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'created',
      entityType: 'team',
      entityId: Number(result.meta.last_row_id),
      entityName: data.name,
    });
  }

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Get seasons for a team
app.get("/api/portal/teams/:teamId/seasons", authMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  
  const { results } = await c.env.DB.prepare(`
    SELECT s.*, ts.division
    FROM seasons s
    JOIN team_seasons ts ON s.id = ts.season_id
    WHERE ts.team_id = ?
    ORDER BY s.year DESC, s.name ASC
  `).bind(teamId).all();

  return c.json(results);
});

// Add team to a season
const addTeamToSeasonSchema = z.object({
  season_id: z.number(),
  division: z.string().optional(),
});

app.post("/api/portal/teams/:teamId/seasons", authMiddleware, adminMiddleware, zValidator("json", addTeamToSeasonSchema), async (c) => {
  const teamId = c.req.param("teamId");
  const data = c.req.valid("json");
  
  const result = await c.env.DB.prepare(
    `INSERT INTO team_seasons (team_id, season_id, division, updated_at) 
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(teamId, data.season_id, data.division || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Team roster
app.get("/api/portal/teams/:teamId/roster", authMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Check if user can access this team's roster
  if (!adminCheck) {
    if (isCoach && !coachTeamIds.includes(parseInt(teamId))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (isParent && familyId) {
      // Check if family has a player on this team
      const hasPlayer = await c.env.DB.prepare(
        `SELECT 1 FROM team_players tp
         JOIN players p ON tp.player_id = p.id
         WHERE tp.team_id = ? AND p.family_id = ? LIMIT 1`
      ).bind(teamId, familyId).first();
      
      if (!hasPlayer) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const { results } = await c.env.DB.prepare(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.jersey_number,
      p.birth_date,
      p.status,
      p.zorts_expiration_date,
      tp.position,
      f.name as family_name
    FROM team_players tp
    JOIN players p ON tp.player_id = p.id
    LEFT JOIN families f ON p.family_id = f.id
    WHERE tp.team_id = ? AND tp.is_active = 1
    ORDER BY p.last_name ASC, p.first_name ASC
  `).bind(teamId).all();

  return c.json(results);
});

// Team coaches endpoints
app.get("/api/portal/teams/:teamId/coaches", authMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Check if user can access this team's coaches
  if (!adminCheck) {
    if (isCoach && !coachTeamIds.includes(parseInt(teamId))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (isParent && familyId) {
      // Check if family has a player on this team
      const hasPlayer = await c.env.DB.prepare(
        `SELECT 1 FROM team_players tp
         JOIN players p ON tp.player_id = p.id
         WHERE tp.team_id = ? AND p.family_id = ? LIMIT 1`
      ).bind(teamId, familyId).first();
      
      if (!hasPlayer) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM team_coaches 
    WHERE team_id = ? AND is_active = 1
    ORDER BY 
      CASE title 
        WHEN 'Head Coach' THEN 1 
        WHEN 'Assistant Coach' THEN 2 
        ELSE 3 
      END,
      name ASC
  `).bind(teamId).all();

  return c.json(results);
});

const createCoachSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
});

app.post("/api/portal/teams/:teamId/coaches", authMiddleware, adminMiddleware, zValidator("json", createCoachSchema), async (c) => {
  const teamId = c.req.param("teamId");
  const data = c.req.valid("json");
  
  const result = await c.env.DB.prepare(
    `INSERT INTO team_coaches (team_id, name, title, email, phone, updated_at) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(teamId, data.name, data.title, data.email || null, data.phone || null).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

const updateCoachSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
});

app.put("/api/portal/team-coaches/:id", authMiddleware, adminMiddleware, zValidator("json", updateCoachSchema), async (c) => {
  const id = c.req.param("id");
  const data = c.req.valid("json");
  
  await c.env.DB.prepare(
    `UPDATE team_coaches 
     SET name = ?, title = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(data.name, data.title, data.email || null, data.phone || null, id).run();

  return c.json({ success: true });
});

app.delete("/api/portal/team-coaches/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  
  await c.env.DB.prepare(
    "UPDATE team_coaches SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

// Team documents endpoints
app.get("/api/portal/teams/:teamId/documents", authMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Check if user can access this team's documents
  if (!adminCheck) {
    if (isCoach && !coachTeamIds.includes(parseInt(teamId))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (isParent && familyId) {
      // Check if family has a player on this team
      const hasPlayer = await c.env.DB.prepare(
        `SELECT 1 FROM team_players tp
         JOIN players p ON tp.player_id = p.id
         WHERE tp.team_id = ? AND p.family_id = ? LIMIT 1`
      ).bind(teamId, familyId).first();
      
      if (!hasPlayer) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM team_documents 
    WHERE team_id = ?
    ORDER BY created_at DESC
  `).bind(teamId).all();

  return c.json(results);
});

app.post("/api/portal/teams/:teamId/documents", authMiddleware, adminMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check document upload permissions
  const canUpload = await canUploadDocuments(c.env.DB, user.id);
  if (!canUpload) {
    return c.json({ error: "Document upload access denied" }, 403);
  }
  
  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string || null;
  
  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }
  
  // Determine content type from file extension
  const getContentType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    const types: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    return types[ext || ''] || 'application/octet-stream';
  };

  // Generate unique file key
  const fileKey = `team-documents/${teamId}/${Date.now()}-${file.name}`;
  
  // Upload to R2
  await c.env.R2_BUCKET.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: getContentType(file.name),
    },
  });
  
  // Save metadata to database
  const result = await c.env.DB.prepare(
    `INSERT INTO team_documents (team_id, title, description, file_key, file_name, file_size, uploaded_by_user_id, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(teamId, title, description, fileKey, file.name, file.size, user.id).run();

  // Send notifications for document upload
  const host = c.req.header("host") || "";
  const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
  
  if (isProduction) {
    const teamName = await c.env.DB.prepare("SELECT name FROM teams WHERE id = ?").bind(teamId).first();
    const userName = getUserDisplayName(user);
    
    const emailHtml = `
      <h2>New Team Document</h2>
      <p><strong>Team:</strong> ${teamName?.name || 'Team'}</p>
      <p><strong>Uploaded by:</strong> ${userName}</p>
      <p><strong>Document:</strong> ${title}</p>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <p><strong>File:</strong> ${file.name}</p>
      <p><a href="https://capeannnoreasters.com/portal/teams/${teamId}">View Team Documents</a></p>
    `;
    
    const smsText = `New document uploaded to ${teamName?.name || 'team'}: ${title}. View at capeannnoreasters.com/portal/teams/${teamId}`;
    
    await sendNotifications({
      env: c.env,
      type: 'documents',
      subject: `New Document: ${title}`,
      emailHtml,
      smsText,
      teamId: parseInt(teamId),
    }).catch(err => console.error('Failed to send document notifications:', err));
  }

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Download team document
app.get("/api/portal/teams/documents/download/*", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check document download permissions
  const canDownload = await canDownloadDocuments(c.env.DB, user.id);
  if (!canDownload) {
    return c.json({ error: "Document download access denied" }, 403);
  }

  // Get the file key from the path after /download/
  const path = c.req.path;
  const fileKey = path.replace('/api/portal/teams/documents/download/', '');

  const object = await c.env.R2_BUCKET.get(fileKey);
  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
  
  // Extract filename from key
  const fileName = fileKey.split('/').pop() || 'download';
  const safeFileName = fileName.replace(/[^\x20-\x7E]/g, '_');

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": object.size.toString(),
      "Cache-Control": "no-cache",
    },
  });
});



// Families endpoints
app.get("/api/portal/families", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM families ORDER BY name ASC"
  ).all();
  return c.json(results);
});

const createFamilySchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  user_id: z.string().optional(),
});

app.post("/api/portal/families", authMiddleware, zValidator("json", createFamilySchema), async (c) => {
  const data = c.req.valid("json");
  
  const result = await c.env.DB.prepare(
    `INSERT INTO families (name, email, phone, address, emergency_contact_name, emergency_contact_phone, user_id, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    data.name, 
    data.email || null, 
    data.phone || null, 
    data.address || null,
    data.emergency_contact_name || null,
    data.emergency_contact_phone || null,
    data.user_id || null
  ).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Get players for a specific family
app.get("/api/portal/families/:id/players", authMiddleware, async (c) => {
  const familyId = c.req.param("id");
  
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, f.name as family_name
     FROM players p
     JOIN families f ON p.family_id = f.id
     WHERE p.family_id = ?
     ORDER BY p.first_name ASC, p.last_name ASC`
  ).bind(familyId).all();
  
  return c.json(results);
});

// Players endpoints
const createPlayerSchema = z.object({
  family_id: z.number(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  birth_date: z.string().optional(),
  jersey_number: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  uniform_size: z.string().optional(),
  zorts_expiration_date: z.string().optional(),
  zorts_id: z.string().optional(),
  grade: z.string().optional(),
  address_1: z.string().optional(),
  address_2: z.string().optional(),
  town: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  parent_1_name: z.string().optional(),
  parent_1_phone: z.string().optional(),
  parent_1_email: z.string().optional(),
  parent_2_name: z.string().optional(),
  parent_2_phone: z.string().optional(),
  parent_2_email: z.string().optional(),
});

app.get("/api/portal/players", authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, first_name, last_name, family_id, jersey_number, birth_date, status, zorts_expiration_date FROM players ORDER BY last_name ASC, first_name ASC"
  ).all();
  return c.json(results);
});

app.get("/api/portal/players/all", authMiddleware, async (c) => {
  const user = c.get("user") as { id: string; email: string };
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  
  if (adminCheck) {
    // Admins see all players
    const { results } = await c.env.DB.prepare(
      `SELECT p.*, f.name as family_name
       FROM players p
       LEFT JOIN families f ON p.family_id = f.id
       ORDER BY p.last_name ASC, p.first_name ASC`
    ).all();
    return c.json(results);
  }
  
  // Check if coach - see players on their teams
  const roles = await getUserRoles(c.env.DB, user.id);
  const coachTeamIds = roles
    .filter(r => r.role === 'coach' && r.team_id)
    .map(r => r.team_id);
  
  if (coachTeamIds.length > 0) {
    const placeholders = coachTeamIds.map(() => '?').join(',');
    const { results } = await c.env.DB.prepare(
      `SELECT DISTINCT p.*, f.name as family_name
       FROM players p
       LEFT JOIN families f ON p.family_id = f.id
       INNER JOIN team_players tp ON p.id = tp.player_id
       WHERE tp.team_id IN (${placeholders})
       ORDER BY p.last_name ASC, p.first_name ASC`
    ).bind(...coachTeamIds).all();
    return c.json(results);
  }
  
  // Parents see only their family's players
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  if (familyId) {
    const { results } = await c.env.DB.prepare(
      `SELECT p.*, f.name as family_name
       FROM players p
       LEFT JOIN families f ON p.family_id = f.id
       WHERE p.family_id = ?
       ORDER BY p.last_name ASC, p.first_name ASC`
    ).bind(familyId).all();
    return c.json(results);
  }
  
  return c.json([]);
});

app.get("/api/portal/players/:id", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const player = await c.env.DB.prepare(
    `SELECT p.*, f.name as family_name
     FROM players p
     LEFT JOIN families f ON p.family_id = f.id
     WHERE p.id = ?`
  ).bind(playerId).first();
  
  if (!player) {
    return c.json({ error: "Player not found" }, 404);
  }

  // Check user's role and access
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Restrict access for non-admins
  if (!adminCheck) {
    if (isParent && familyId) {
      // Parents can only see their own family's players
      if ((player as any).family_id !== familyId) {
        return c.json({ error: "Forbidden" }, 403);
      }
    } else if (isCoach) {
      // Coaches can only see players on their teams
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  return c.json(player);
});

app.post("/api/portal/players/:id/photo", authMiddleware, adminMiddleware, async (c) => {
  const playerId = c.req.param("id");
  
  const formData = await c.req.formData();
  const file = formData.get("photo") as File;
  
  if (!file) {
    return c.json({ error: "No photo provided" }, 400);
  }
  
  // Check if it's an image
  if (!file.type.startsWith("image/")) {
    return c.json({ error: "File must be an image" }, 400);
  }
  
  // Generate unique file key
  const fileKey = `player-photos/${playerId}/${Date.now()}-${file.name}`;
  
  // Upload to R2
  await c.env.R2_BUCKET.put(fileKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
    },
  });
  
  // Update player record with photo_key
  await c.env.DB.prepare(
    `UPDATE players SET photo_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(fileKey, playerId).run();
  
  return c.json({ photo_key: fileKey }, 200);
});

app.get("/api/portal/players/:id/photo", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access to this player
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);
  
  const player = await c.env.DB.prepare(
    "SELECT photo_key, family_id FROM players WHERE id = ?"
  ).bind(playerId).first();
  
  if (!player || !player.photo_key) {
    return c.json({ error: "Photo not found" }, 404);
  }

  if (!adminCheck) {
    const isParent = roles.some(r => r.role === 'Parent');
    const isCoach = roles.some(r => r.role === 'Coach');

    if (isParent && familyId && (player as any).family_id !== familyId) {
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach) {
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const object = await c.env.R2_BUCKET.get(player.photo_key as string);
  
  if (!object) {
    return c.json({ error: "Photo not found in storage" }, 404);
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  
  return c.body(object.body, { headers });
});

app.post("/api/portal/players", authMiddleware, adminMiddleware, zValidator("json", createPlayerSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  
  const result = await c.env.DB.prepare(
    `INSERT INTO players (
      family_id, first_name, last_name, birth_date, jersey_number, notes,
      status, uniform_size, zorts_expiration_date, zorts_id, grade,
      address_1, address_2, town, state, zip_code,
      parent_1_name, parent_1_phone, parent_1_email,
      parent_2_name, parent_2_phone, parent_2_email,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    data.family_id,
    data.first_name,
    data.last_name,
    data.birth_date || null,
    data.jersey_number || null,
    data.notes || null,
    data.status || null,
    data.uniform_size || null,
    data.zorts_expiration_date || null,
    data.zorts_id || null,
    data.grade || null,
    data.address_1 || null,
    data.address_2 || null,
    data.town || null,
    data.state || null,
    data.zip_code || null,
    data.parent_1_name || null,
    data.parent_1_phone || null,
    data.parent_1_email || null,
    data.parent_2_name || null,
    data.parent_2_phone || null,
    data.parent_2_email || null
  ).run();

  if (user) {
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'created',
      entityType: 'player',
      entityId: Number(result.meta.last_row_id),
      entityName: `${data.first_name} ${data.last_name}`,
      familyId: data.family_id,
    });
  }

  return c.json({ id: result.meta.last_row_id }, 201);
});

app.put("/api/portal/players/:id", authMiddleware, adminMiddleware, zValidator("json", createPlayerSchema), async (c) => {
  const playerId = c.req.param("id");
  const data = c.req.valid("json");
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await c.env.DB.prepare(
    `UPDATE players SET
      family_id = ?, first_name = ?, last_name = ?, birth_date = ?, jersey_number = ?, notes = ?,
      status = ?, uniform_size = ?, zorts_expiration_date = ?, zorts_id = ?, grade = ?,
      address_1 = ?, address_2 = ?, town = ?, state = ?, zip_code = ?,
      parent_1_name = ?, parent_1_phone = ?, parent_1_email = ?,
      parent_2_name = ?, parent_2_phone = ?, parent_2_email = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).bind(
    data.family_id,
    data.first_name,
    data.last_name,
    data.birth_date || null,
    data.jersey_number || null,
    data.notes || null,
    data.status || null,
    data.uniform_size || null,
    data.zorts_expiration_date || null,
    data.zorts_id || null,
    data.grade || null,
    data.address_1 || null,
    data.address_2 || null,
    data.town || null,
    data.state || null,
    data.zip_code || null,
    data.parent_1_name || null,
    data.parent_1_phone || null,
    data.parent_1_email || null,
    data.parent_2_name || null,
    data.parent_2_phone || null,
    data.parent_2_email || null,
    playerId
  ).run();

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'updated',
    entityType: 'player',
    entityId: Number(playerId),
    entityName: `${data.first_name} ${data.last_name}`,
    familyId: data.family_id,
  });

  return c.json({ success: true });
});

// Add player to team
const addPlayerToTeamSchema = z.object({
  team_id: z.number(),
  player_id: z.number(),
});

app.delete("/api/portal/players/:id", authMiddleware, adminMiddleware, async (c) => {
  const playerId = c.req.param("id");
  
  // Delete player's team associations first
  await c.env.DB.prepare("DELETE FROM team_players WHERE player_id = ?").bind(playerId).run();
  
  // Delete player's attendance records
  await c.env.DB.prepare("DELETE FROM attendance WHERE player_id = ?").bind(playerId).run();
  
  // Delete player's event invites
  await c.env.DB.prepare("DELETE FROM event_invites WHERE player_id = ?").bind(playerId).run();
  
  // Delete the player
  await c.env.DB.prepare("DELETE FROM players WHERE id = ?").bind(playerId).run();
  
  return c.json({ success: true });
});

// Get upcoming events for a player
app.get("/api/portal/players/:id/events/upcoming", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access to this player
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck) {
    // Check if user can access this player's data
    const player = await c.env.DB.prepare(`SELECT family_id FROM players WHERE id = ?`).bind(playerId).first();
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }

    const isParent = roles.some(r => r.role === 'Parent');
    const isCoach = roles.some(r => r.role === 'Coach');

    if (isParent && familyId && (player as any).family_id !== familyId) {
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach) {
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const events = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_type, e.start_at, e.location, a.status as rsvp_status
     FROM event_invites ei
     JOIN events e ON ei.event_id = e.id
     LEFT JOIN attendance a ON a.event_id = e.id AND a.player_id = ei.player_id
     WHERE ei.player_id = ? AND e.start_at >= datetime('now') AND e.is_cancelled = 0
     ORDER BY e.start_at ASC`
  ).bind(playerId).all();
  
  return c.json(events.results || []);
});

// Get past events for a player
app.get("/api/portal/players/:id/events/past", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access to this player
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck) {
    // Check if user can access this player's data
    const player = await c.env.DB.prepare(`SELECT family_id FROM players WHERE id = ?`).bind(playerId).first();
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }

    const isParent = roles.some(r => r.role === 'Parent');
    const isCoach = roles.some(r => r.role === 'Coach');

    if (isParent && familyId && (player as any).family_id !== familyId) {
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach) {
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const events = await c.env.DB.prepare(
    `SELECT e.id, e.title, e.event_type, e.start_at, e.location, a.status as rsvp_status
     FROM event_invites ei
     JOIN events e ON ei.event_id = e.id
     LEFT JOIN attendance a ON a.event_id = e.id AND a.player_id = ei.player_id
     WHERE ei.player_id = ? AND e.start_at < datetime('now')
     ORDER BY e.start_at DESC`
  ).bind(playerId).all();
  
  return c.json(events.results || []);
});

// Get payments for a player's family
app.get("/api/portal/players/:id/payments", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access to this player
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck) {
    // Check if user can access this player's data
    const player = await c.env.DB.prepare(`SELECT family_id FROM players WHERE id = ?`).bind(playerId).first();
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }

    const isParent = roles.some(r => r.role === 'Parent');
    const isCoach = roles.some(r => r.role === 'Coach');

    if (isParent && familyId && (player as any).family_id !== familyId) {
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach) {
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  // Get player payments from player_payments table joined with payments table
  const payments = await c.env.DB.prepare(
    `SELECT 
      pp.id,
      p.description,
      pp.amount,
      p.due_date,
      pp.paid_at,
      pp.status,
      p.notes
     FROM player_payments pp
     JOIN payments p ON pp.payment_id = p.id
     WHERE pp.player_id = ?
     ORDER BY p.due_date DESC, pp.created_at DESC`
  ).bind(playerId).all();
  
  return c.json(payments.results || []);
});

// Get uniform orders for a player
app.get("/api/portal/players/:id/uniform-orders", authMiddleware, async (c) => {
  const playerId = c.req.param("id");
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role and access to this player
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck) {
    // Check if user can access this player's data
    const player = await c.env.DB.prepare(`SELECT family_id FROM players WHERE id = ?`).bind(playerId).first();
    if (!player) {
      return c.json({ error: "Player not found" }, 404);
    }

    const isParent = roles.some(r => r.role === 'Parent');
    const isCoach = roles.some(r => r.role === 'Coach');

    if (isParent && familyId && (player as any).family_id !== familyId) {
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach) {
      const playerOnCoachTeam = await c.env.DB.prepare(
        `SELECT 1 FROM team_players WHERE player_id = ? AND team_id IN (${coachTeamIds.map(() => '?').join(',')}) LIMIT 1`
      ).bind(playerId, ...coachTeamIds).first();
      if (!playerOnCoachTeam) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
  }
  
  const orders = await c.env.DB.prepare(
    `SELECT * FROM uniform_orders 
     WHERE player_id = ?
     ORDER BY submitted_at DESC, created_at DESC`
  ).bind(playerId).all();
  
  return c.json(orders.results || []);
});

// Payment management endpoints
const createPaymentSchema = z.object({
  team_id: z.number(),
  description: z.string().min(1),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  payment_type: z.enum(['fixed', 'split']),
  amount: z.number().positive(), // For fixed: amount per player; For split: total amount
  player_ids: z.array(z.number()).min(1),
});

app.get("/api/portal/payments", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if admin
  const admin = await c.env.DB.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(user.email).first();

  if (admin) {
    // Admin: Get all payments with team info
    const { results } = await c.env.DB.prepare(
      `SELECT p.id, p.team_id, p.description, p.due_date, p.notes, 
              p.payment_type, p.total_amount, p.created_at,
              t.name as team_name
       FROM payments p
       LEFT JOIN teams t ON p.team_id = t.id
       ORDER BY p.due_date DESC, p.created_at DESC`
    ).all();
    return c.json(results);
  } else {
    // Parent: Get payments for their family
    const family = await c.env.DB.prepare(
      "SELECT id FROM families WHERE user_id = ?"
    ).bind(user.id).first();

    if (!family) {
      return c.json([]);
    }

    // Get players in this family
    const { results: players } = await c.env.DB.prepare(
      "SELECT id FROM players WHERE family_id = ?"
    ).bind(family.id).all();

    if (!players || players.length === 0) {
      return c.json([]);
    }

    const playerIds = players.map((p: any) => p.id);

    // Get player payments for these players
    const { results } = await c.env.DB.prepare(
      `SELECT pp.id, pp.payment_id, pp.player_id, pp.amount, pp.status, pp.paid_at,
              p.description, p.due_date, p.notes, p.team_id,
              t.name as team_name,
              pl.first_name, pl.last_name
       FROM player_payments pp
       JOIN payments p ON pp.payment_id = p.id
       LEFT JOIN teams t ON p.team_id = t.id
       JOIN players pl ON pp.player_id = pl.id
       WHERE pp.player_id IN (${playerIds.map(() => '?').join(',')})
       ORDER BY p.due_date DESC, p.created_at DESC`
    ).bind(...playerIds).all();

    return c.json(results);
  }
});

app.post("/api/portal/payments", authMiddleware, adminMiddleware, zValidator("json", createPaymentSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Calculate amounts
  let totalAmount: number;
  let amountPerPlayer: number;

  if (data.payment_type === 'fixed') {
    // Fixed: each player pays the specified amount
    amountPerPlayer = data.amount;
    totalAmount = data.amount * data.player_ids.length;
  } else {
    // Split: total amount divided among selected players
    totalAmount = data.amount;
    amountPerPlayer = data.amount / data.player_ids.length;
  }

  // Create the payment record
  const paymentResult = await c.env.DB.prepare(
    `INSERT INTO payments (team_id, description, due_date, status, notes, payment_type, total_amount, family_id, amount, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)`
  ).bind(
    data.team_id,
    data.description,
    data.due_date || null,
    data.notes || null,
    data.payment_type,
    totalAmount
  ).run();

  const paymentId = paymentResult.meta.last_row_id;

  // Create player_payments records for each selected player
  for (const playerId of data.player_ids) {
    await c.env.DB.prepare(
      `INSERT INTO player_payments (payment_id, player_id, amount, status, updated_at)
       VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`
    ).bind(paymentId, playerId, amountPerPlayer).run();
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'created',
    entityType: 'payment',
    entityId: Number(paymentId),
    entityName: data.description,
    teamId: data.team_id,
    details: `$${totalAmount.toFixed(2)} - ${data.player_ids.length} player(s)`,
  });

  // Send payment notification
  const host = c.req.header("host") || "";
  const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
  
  if (isProduction) {
    const team = await c.env.DB.prepare("SELECT name FROM teams WHERE id = ?").bind(data.team_id).first();
    const dueDate = data.due_date ? new Date(data.due_date).toLocaleDateString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'medium'
    }) : 'No due date';
    
    const emailHtml = `
      <h2>New Payment Due</h2>
      <p><strong>Team:</strong> ${team?.name || 'Team'}</p>
      <p><strong>Description:</strong> ${data.description}</p>
      <p><strong>Amount:</strong> $${amountPerPlayer.toFixed(2)} per player</p>
      <p><strong>Due Date:</strong> ${dueDate}</p>
      ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
      <p><a href="https://capeannnoreasters.com/portal/payments">View Payment Details</a></p>
      <p><em>Payment can be made via Venmo to @kevinreilley</em></p>
    `;
    
    const smsText = `New payment due: ${data.description} - $${amountPerPlayer.toFixed(2)}. Due ${dueDate}. View at capeannnoreasters.com/portal/payments`;
    
    await sendNotifications({
      env: c.env,
      type: 'payment_reminders',
      subject: `Payment Due: ${data.description}`,
      emailHtml,
      smsText,
      teamId: data.team_id,
    }).catch(err => console.error('Failed to send payment notifications:', err));
  }

  return c.json({ id: paymentId }, 201);
});

app.put("/api/portal/payments/:id", authMiddleware, adminMiddleware, zValidator("json", createPaymentSchema), async (c) => {
  const paymentId = c.req.param("id");
  const data = c.req.valid("json");

  // Calculate amounts
  let totalAmount: number;
  let amountPerPlayer: number;

  if (data.payment_type === 'fixed') {
    amountPerPlayer = data.amount;
    totalAmount = data.amount * data.player_ids.length;
  } else {
    totalAmount = data.amount;
    amountPerPlayer = data.amount / data.player_ids.length;
  }

  // Update the payment record
  await c.env.DB.prepare(
    `UPDATE payments 
     SET team_id = ?, description = ?, due_date = ?, notes = ?, payment_type = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    data.team_id,
    data.description,
    data.due_date || null,
    data.notes || null,
    data.payment_type,
    totalAmount,
    paymentId
  ).run();

  // Delete existing player_payments and recreate them
  await c.env.DB.prepare(
    `DELETE FROM player_payments WHERE payment_id = ?`
  ).bind(paymentId).run();

  // Create new player_payments records
  for (const playerId of data.player_ids) {
    await c.env.DB.prepare(
      `INSERT INTO player_payments (payment_id, player_id, amount, status, updated_at)
       VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)`
    ).bind(paymentId, playerId, amountPerPlayer).run();
  }

  return c.json({ success: true });
});

app.get("/api/portal/all-player-payments", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user || !user.email) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT pp.id, pp.payment_id, pp.player_id, pp.amount, pp.status, pp.paid_at,
            pp.waived_at, pp.waived_by_name, pp.waiver_reason,
            pl.first_name, pl.last_name, pl.jersey_number, pl.family_id,
            f.name as family_name,
            p.team_id, p.description, p.due_date,
            t.name as team_name
     FROM player_payments pp
     JOIN players pl ON pp.player_id = pl.id
     LEFT JOIN families f ON pl.family_id = f.id
     JOIN payments p ON pp.payment_id = p.id
     LEFT JOIN teams t ON p.team_id = t.id
     ORDER BY pp.created_at DESC`
  ).all();

  return c.json(results);
});

app.get("/api/portal/payments/:id/players", authMiddleware, async (c) => {
  const paymentId = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    `SELECT pp.id, pp.player_id, pp.amount, pp.status, pp.paid_at,
            p.first_name, p.last_name, p.jersey_number,
            f.name as family_name
     FROM player_payments pp
     JOIN players p ON pp.player_id = p.id
     LEFT JOIN families f ON p.family_id = f.id
     WHERE pp.payment_id = ?
     ORDER BY p.last_name, p.first_name`
  ).bind(paymentId).all();

  return c.json(results);
});

app.put("/api/portal/player-payments/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get player payment info before update
  const playerPayment = await c.env.DB.prepare(`
    SELECT pp.*, p.first_name, p.last_name, pay.description
    FROM player_payments pp
    JOIN players p ON pp.player_id = p.id
    JOIN payments pay ON pp.payment_id = pay.id
    WHERE pp.id = ?
  `).bind(id).first();

  const updates: string[] = [];
  const values: any[] = [];

  if (body.status !== undefined) {
    updates.push("status = ?");
    values.push(body.status);
    
    if (body.status === 'paid') {
      updates.push("paid_at = CURRENT_TIMESTAMP");
    } else {
      updates.push("paid_at = NULL");
    }
  }

  if (updates.length === 0) {
    return c.json({ error: "No updates provided" }, 400);
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE player_payments SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  if (playerPayment) {
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'updated',
      entityType: 'payment',
      entityId: Number(id),
      entityName: (playerPayment as any).description,
      details: `${(playerPayment as any).first_name} ${(playerPayment as any).last_name} - ${body.status}`,
    });
  }

  return c.json({ success: true });
});

// Waive a player payment
app.post("/api/portal/player-payments/:id/waive", authMiddleware, adminMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const waiver_reason = body.waiver_reason || "";

  // Get player payment info with family email
  const playerPayment = await c.env.DB.prepare(`
    SELECT pp.*, p.first_name, p.last_name, p.family_id, 
           pay.description, pay.due_date,
           f.name as family_name, f.email as family_email,
           p.parent_1_email, p.parent_2_email
    FROM player_payments pp
    JOIN players p ON pp.player_id = p.id
    JOIN payments pay ON pp.payment_id = pay.id
    LEFT JOIN families f ON p.family_id = f.id
    WHERE pp.id = ?
  `).bind(id).first() as any;

  if (!playerPayment) {
    return c.json({ error: "Payment not found" }, 404);
  }

  const userName = user.email || "Admin";

  // Update the payment status to waived
  await c.env.DB.prepare(`
    UPDATE player_payments 
    SET status = 'waived', 
        waived_at = CURRENT_TIMESTAMP,
        waived_by_user_id = ?,
        waived_by_name = ?,
        waiver_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(user.id, userName, waiver_reason, id).run();

  // Send email notification to family
  const recipientEmail = playerPayment.family_email || playerPayment.parent_1_email || playerPayment.parent_2_email;
  
  if (recipientEmail) {
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px;">
    <div style="background: linear-gradient(135deg, #00c4ff 0%, #0099cc 100%); padding: 24px 40px;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Cape Ann Nor'easters</h1>
    </div>
    <div style="padding: 40px;">
      <h2 style="margin: 0 0 16px 0; color: #18181b; font-size: 20px;">Fee Waiver Notification</h2>
      <p style="margin: 0 0 16px 0; color: #3f3f46; font-size: 16px; line-height: 1.6;">
        A fee has been waived for your family. This email serves as your official record of this waiver.
      </p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Player</p>
        <p style="margin: 0 0 16px 0; color: #18181b; font-size: 16px; font-weight: 600;">${playerPayment.first_name} ${playerPayment.last_name}</p>
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Description</p>
        <p style="margin: 0 0 16px 0; color: #18181b; font-size: 16px; font-weight: 600;">${playerPayment.description}</p>
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Amount Waived</p>
        <p style="margin: 0 0 16px 0; color: #22c55e; font-size: 20px; font-weight: 600;">$${playerPayment.amount.toFixed(2)}</p>
        ${waiver_reason ? `
        <p style="margin: 0 0 8px 0; color: #71717a; font-size: 14px;">Reason</p>
        <p style="margin: 0; color: #18181b; font-size: 16px;">${waiver_reason}</p>
        ` : ''}
      </div>
      <p style="margin: 0; color: #71717a; font-size: 14px;">
        Waived by ${userName} on ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </div>
    <div style="padding: 24px 40px; border-top: 1px solid #e4e4e7;">
      <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">Cape Ann Nor'easters Flag Football</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailText = `Fee Waiver Notification\n\nA fee has been waived for your family.\n\nPlayer: ${playerPayment.first_name} ${playerPayment.last_name}\nDescription: ${playerPayment.description}\nAmount Waived: $${playerPayment.amount.toFixed(2)}${waiver_reason ? `\nReason: ${waiver_reason}` : ''}\n\nWaived by ${userName} on ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}\n\nThis email serves as your official record of this waiver.`;

    try {
      await c.env.EMAILS.send({
        to: recipientEmail,
        subject: 'Fee Waiver - Cape Ann Nor\'easters',
        html_body: emailHtml,
        text_body: emailText,
      });
    } catch (emailError) {
      console.error("Failed to send waiver email:", emailError);
    }
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: userName,
    action: 'waived',
    entityType: 'payment',
    entityId: Number(id),
    entityName: playerPayment.description,
    familyId: playerPayment.family_id,
    details: `${playerPayment.first_name} ${playerPayment.last_name} - $${playerPayment.amount.toFixed(2)}${waiver_reason ? ` - ${waiver_reason}` : ''}`,
  });

  return c.json({ success: true });
});

app.delete("/api/portal/payments/:id", authMiddleware, adminMiddleware, async (c) => {
  const paymentId = c.req.param("id");

  // Delete player_payments first
  await c.env.DB.prepare(
    "DELETE FROM player_payments WHERE payment_id = ?"
  ).bind(paymentId).run();

  // Delete the payment
  await c.env.DB.prepare(
    "DELETE FROM payments WHERE id = ?"
  ).bind(paymentId).run();

  return c.json({ success: true });
});

app.post("/api/portal/team-players", authMiddleware, adminMiddleware, zValidator("json", addPlayerToTeamSchema), async (c) => {
  const data = c.req.valid("json");
  
  // Check if player is already on team
  const existing = await c.env.DB.prepare(
    "SELECT id FROM team_players WHERE team_id = ? AND player_id = ?"
  ).bind(data.team_id, data.player_id).first();

  if (existing) {
    // Reactivate if previously removed
    await c.env.DB.prepare(
      "UPDATE team_players SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(existing.id).run();
    return c.json({ id: existing.id });
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO team_players (team_id, player_id, is_active, updated_at) 
     VALUES (?, ?, 1, CURRENT_TIMESTAMP)`
  ).bind(data.team_id, data.player_id).run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Remove player from team
app.delete("/api/portal/team-players/:teamId/:playerId", authMiddleware, adminMiddleware, async (c) => {
  const teamId = c.req.param("teamId");
  const playerId = c.req.param("playerId");
  
  await c.env.DB.prepare(
    "UPDATE team_players SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE team_id = ? AND player_id = ?"
  ).bind(teamId, playerId).run();

  return c.json({ success: true });
});

// Get all teams (for dropdowns)
app.get("/api/portal/teams/all", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const roles = await getUserRoles(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'coach' && r.team_id).map(r => r.team_id);
  const isCoachOnly = coachTeamIds.length > 0 && !adminCheck;
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const isParentOnly = !adminCheck && coachTeamIds.length === 0 && familyId;

  let query = "SELECT id, name, age_group FROM teams";
  let params: any[] = [];

  if (isCoachOnly) {
    // Coaches see only their assigned teams
    const placeholders = coachTeamIds.map(() => '?').join(',');
    query += ` WHERE id IN (${placeholders})`;
    params = coachTeamIds;
  } else if (isParentOnly) {
    // Parents see teams their children are on
    query += ` WHERE id IN (
      SELECT DISTINCT tp.team_id 
      FROM team_players tp 
      JOIN players p ON tp.player_id = p.id 
      WHERE p.family_id = ?
    )`;
    params = [familyId];
  }
  // Admins see all teams (no WHERE clause)

  query += " ORDER BY age_group ASC, name ASC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results);
});

// Events endpoints
app.get("/api/portal/events", authMiddleware, async (c) => {
  const start = c.req.query("start");
  const end = c.req.query("end");
  const teamId = c.req.query("team_id");
  
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const roles = await getUserRoles(c.env.DB, user.id);
  const isCoach = roles.some(r => r.role === 'coach');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const isParent = !adminCheck && !isCoach && familyId;

  let query = `
    SELECT 
      e.*,
      t.name as team_name,
      COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) as rsvp_yes,
      COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) as rsvp_no,
      COALESCE(SUM(CASE WHEN a.status = 'maybe' THEN 1 ELSE 0 END), 0) as rsvp_maybe,
      COALESCE(COUNT(DISTINCT ei.player_id), 0) as total_invited,
      COALESCE(COUNT(DISTINCT ei.player_id), 0) - COALESCE(COUNT(DISTINCT a.player_id), 0) as rsvp_no_response
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    LEFT JOIN event_invites ei ON e.id = ei.event_id
    LEFT JOIN attendance a ON e.id = a.event_id AND ei.player_id = a.player_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Parents only see events their children are invited to
  if (isParent) {
    query += ` AND e.id IN (
      SELECT DISTINCT ei2.event_id 
      FROM event_invites ei2 
      JOIN players p ON ei2.player_id = p.id 
      WHERE p.family_id = ?
    )`;
    params.push(familyId);
  }

  if (start) {
    query += " AND e.start_at >= ?";
    params.push(start);
  }
  if (end) {
    query += " AND e.start_at <= ?";
    params.push(end);
  }
  if (teamId) {
    query += " AND (e.team_id = ? OR e.team_id IS NULL)";
    params.push(teamId);
  }

  query += " GROUP BY e.id ORDER BY e.start_at ASC";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results);
});

const createEventSchema = z.object({
  team_id: z.number().nullable().optional(),
  event_type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  start_at: z.string(),
  end_at: z.string().optional(),
  cost: z.number().nullable().optional(),
  player_ids: z.array(z.number()).optional(),
});

app.post("/api/portal/events", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if admin or has events_manage permission
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const canManage = await canManageEvents(c.env.DB, user.id);
  if (!adminCheck && !canManage) {
    return c.json({ error: "Event management access denied" }, 403);
  }

  const parseResult = createEventSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "Invalid data" }, 400);
  }
  const data = parseResult.data;

  const result = await c.env.DB.prepare(
    `INSERT INTO events (team_id, event_type, title, description, location, start_at, end_at, cost, is_cancelled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
  ).bind(
    data.team_id || null,
    data.event_type,
    data.title,
    data.description || null,
    data.location || null,
    data.start_at,
    data.end_at || null,
    data.cost ?? null
  ).run();

  const eventId = result.meta.last_row_id;

  // Add event invites for selected players
  if (data.player_ids && data.player_ids.length > 0) {
    for (const playerId of data.player_ids) {
      await c.env.DB.prepare(
        `INSERT INTO event_invites (event_id, player_id, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`
      ).bind(eventId, playerId).run();

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'created',
    entityType: 'event',
    entityId: Number(eventId),
    entityName: data.title,
    teamId: data.team_id || undefined,
    details: data.event_type,
  });
    }
  }

  // Send notifications for schedule changes
  const host = c.req.header("host") || "";
  const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
  
  if (isProduction) {
    const eventTime = new Date(data.start_at).toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const emailHtml = `
      <h2>New Event Added to Schedule</h2>
      <p><strong>Event:</strong> ${data.title}</p>
      <p><strong>Type:</strong> ${data.event_type}</p>
      <p><strong>Date & Time:</strong> ${eventTime}</p>
      ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      ${data.description ? `<p><strong>Details:</strong> ${data.description}</p>` : ''}
      <p><a href="https://capeannnoreasters.com/portal/schedule">View Schedule</a></p>
    `;
    
    const smsText = `New event: ${data.title} on ${eventTime}${data.location ? ' at ' + data.location : ''}. View at capeannnoreasters.com/portal/schedule`;
    
    await sendNotifications({
      env: c.env,
      type: 'schedule_changes',
      subject: `New Event: ${data.title}`,
      emailHtml,
      smsText,
      teamId: data.team_id || undefined,
    }).catch(err => console.error('Failed to send schedule notifications:', err));
  }

  return c.json({ id: eventId }, 201);
});

const updateEventSchema = z.object({
  team_id: z.number().nullable().optional(),
  event_type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  cost: z.number().nullable().optional(),
  is_cancelled: z.boolean().optional(),
  player_ids: z.array(z.number()).optional(),
});

app.patch("/api/portal/events/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if admin or has events_manage permission
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const canManage = await canManageEvents(c.env.DB, user.id);
  if (!adminCheck && !canManage) {
    return c.json({ error: "Event management access denied" }, 403);
  }

  const parseResult = updateEventSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "Invalid data" }, 400);
  }
  const data = parseResult.data;
  const id = c.req.param("id");

  const updates: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && key !== "player_ids") {
      if (key === "is_cancelled") {
        updates.push(`${key} = ?`);
        values.push(value ? 1 : 0);
      } else {
        updates.push(`${key} = ?`);
        values.push(value === "" ? null : value);
      }
    }
  });

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE events SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();
  }

  // Update event invites if player_ids provided
  if (data.player_ids !== undefined) {
    // Delete existing invites
    await c.env.DB.prepare("DELETE FROM event_invites WHERE event_id = ?").bind(id).run();
    
    // Add new invites
    if (data.player_ids.length > 0) {
      for (const playerId of data.player_ids) {
        await c.env.DB.prepare(
          `INSERT INTO event_invites (event_id, player_id, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)`
        ).bind(id, playerId).run();
      }
    }
  }

  // Send notifications for schedule changes
  const host = c.req.header("host") || "";
  const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
  
  if (isProduction && updates.length > 0) {
    const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
    
    if (event) {
      const eventTime = new Date(event.start_at as string).toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      const emailHtml = `
        <h2>Event Updated</h2>
        <p><strong>Event:</strong> ${event.title}</p>
        <p><strong>Type:</strong> ${event.event_type}</p>
        <p><strong>Date & Time:</strong> ${eventTime}</p>
        ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
        ${event.description ? `<p><strong>Details:</strong> ${event.description}</p>` : ''}
        ${event.is_cancelled ? '<p style="color: red;"><strong>STATUS: CANCELLED</strong></p>' : ''}
        <p><a href="https://capeannnoreasters.com/portal/schedule">View Schedule</a></p>
      `;
      
      const smsText = `Event updated: ${event.title} on ${eventTime}${event.location ? ' at ' + event.location : ''}${event.is_cancelled ? ' - CANCELLED' : ''}. View at capeannnoreasters.com/portal/schedule`;
      
      await sendNotifications({
        env: c.env,
        type: 'schedule_changes',
        subject: `Schedule Update: ${event.title}`,
        emailHtml,
        smsText,
        teamId: event.team_id as number | undefined,
      }).catch(err => console.error('Failed to send schedule update notifications:', err));
    }
  }

  return c.json({ success: true });
});

app.delete("/api/portal/events/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if admin or has events_manage permission
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const canManage = await canManageEvents(c.env.DB, user.id);
  if (!adminCheck && !canManage) {
    return c.json({ error: "Event management access denied" }, 403);
  }

  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Helper function to generate ICS content
const generateICSContent = (events: any[], calendarName: string = 'Team Schedule') => {
  const formatICSDate = (dateStr: string) => {
    // Parse the date string as Eastern Time and format for iCal
    // Date strings from DB are like "2026-03-20T20:15" (no timezone, assumed Eastern)
    const date = new Date(dateStr);
    // Format as YYYYMMDDTHHMMSS (floating time, no Z suffix)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };
  
  const generateUID = (eventId: number) => {
    return `event-${eventId}@youth-sports-portal.com`;
  };
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Youth Sports Portal//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:America/New_York',
    // Add VTIMEZONE component for Eastern Time
    'BEGIN:VTIMEZONE',
    'TZID:America/New_York',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:-0500',
    'TZOFFSETTO:-0400',
    'TZNAME:EDT',
    'DTSTART:19700308T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:-0400',
    'TZOFFSETTO:-0500',
    'TZNAME:EST',
    'DTSTART:19701101T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  
  for (const event of events as any[]) {
    const startDate = formatICSDate(event.start_at);
    const endDate = event.end_at ? formatICSDate(event.end_at) : startDate;
    
    let description = event.description || '';
    if (event.team_name) {
      description = `Team: ${event.team_name}${description ? '\n' + description : ''}`;
    }
    
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${generateUID(event.id)}`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      `DTSTART;TZID=America/New_York:${startDate}`,
      `DTEND;TZID=America/New_York:${endDate}`,
      `SUMMARY:${event.title.replace(/[,;]/g, '\\$&')}`,
    );
    
    if (description) {
      icsContent.push(`DESCRIPTION:${description.replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n')}`);
    }
    
    if (event.location) {
      icsContent.push(`LOCATION:${event.location.replace(/[,;]/g, '\\$&')}`);
    }
    
    icsContent.push('END:VEVENT');
  }
  
  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
};

// Export events as iCal/ICS format (one-time download)
app.get("/api/portal/events/export/icalendar", authMiddleware, async (c) => {
  const teamIds = c.req.query("team_ids");
  
  let query = `
    SELECT 
      e.id,
      e.team_id,
      e.event_type,
      e.title,
      e.description,
      e.location,
      e.start_at,
      e.end_at,
      e.is_cancelled,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.is_cancelled = 0
    ORDER BY e.start_at ASC
  `;
  
  const { results } = await c.env.DB.prepare(query).all();
  
  // Filter by team IDs if provided
  let events = results || [];
  if (teamIds) {
    const selectedTeamIds = teamIds.split(',').map((id: string) => parseInt(id));
    events = events.filter((event: any) => 
      event.team_id === null || selectedTeamIds.includes(event.team_id)
    );
  }
  
  const icsString = generateICSContent(events);
  
  return new Response(icsString, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="team-schedule.ics"',
    },
  });
});

// Create or update calendar subscription
app.post("/api/portal/calendar-subscription", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const body = await c.req.json();
  // Ensure team_ids is either a string or null, not the string "null"
  const teamIds = body.team_ids && body.team_ids !== 'null' ? body.team_ids : null;
  const name = body.name || 'My Team Calendar';
  
  // Check if user already has a subscription
  const existing = await c.env.DB.prepare(
    "SELECT * FROM calendar_subscriptions WHERE user_id = ?"
  ).bind(user.id).first();
  
  if (existing) {
    // Update existing subscription
    await c.env.DB.prepare(
      `UPDATE calendar_subscriptions 
       SET team_ids = ?, name = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`
    ).bind(teamIds, name, user.id).run();
    
    return c.json({ 
      token: existing.token,
      subscription_url: `/api/public/calendar/${existing.token}.ics`
    });
  } else {
    // Create new subscription with random token
    const token = crypto.randomUUID();
    
    await c.env.DB.prepare(
      `INSERT INTO calendar_subscriptions (user_id, token, name, team_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(user.id, token, name, teamIds).run();
    
    return c.json({ 
      token,
      subscription_url: `/api/public/calendar/${token}.ics`
    }, 201);
  }
});

// Get user's calendar subscription
app.get("/api/portal/calendar-subscription", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const subscription = await c.env.DB.prepare(
    "SELECT token, name, team_ids, is_active FROM calendar_subscriptions WHERE user_id = ?"
  ).bind(user.id).first();
  
  if (subscription) {
    return c.json({
      ...subscription,
      subscription_url: `/api/public/calendar/${subscription.token}.ics`
    });
  }
  
  return c.json({ subscription: null });
});

// Delete calendar subscription
app.delete("/api/portal/calendar-subscription", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  await c.env.DB.prepare(
    "DELETE FROM calendar_subscriptions WHERE user_id = ?"
  ).bind(user.id).run();
  
  return c.json({ success: true });
});

// Public calendar feed endpoint (no auth required, uses token)
app.get("/api/public/calendar/:token", async (c) => {
  // Extract token from URL, removing .ics extension if present
  let token = c.req.param("token");
  if (token && token.endsWith('.ics')) {
    token = token.slice(0, -4);
  }
  
  // Verify token exists and is active
  const subscription = await c.env.DB.prepare(
    "SELECT * FROM calendar_subscriptions WHERE token = ? AND is_active = 1"
  ).bind(token).first();
  
  if (!subscription) {
    return c.text('Calendar not found', 404);
  }
  
  // Get events
  let query = `
    SELECT 
      e.id,
      e.team_id,
      e.event_type,
      e.title,
      e.description,
      e.location,
      e.start_at,
      e.end_at,
      e.is_cancelled,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.is_cancelled = 0
    ORDER BY e.start_at ASC
  `;
  
  const { results } = await c.env.DB.prepare(query).all();
  
  // Filter by team IDs if subscription has them
  let events = results || [];
  if (subscription.team_ids && typeof subscription.team_ids === 'string' && subscription.team_ids !== 'null') {
    const selectedTeamIds = subscription.team_ids.split(',').map((id: string) => parseInt(id));
    events = events.filter((event: any) => 
      event.team_id === null || selectedTeamIds.includes(event.team_id)
    );
  }
  
  const calendarName = (subscription.name && typeof subscription.name === 'string') 
    ? subscription.name 
    : 'Team Schedule';
  const icsString = generateICSContent(events, calendarName);
  
  return new Response(icsString, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
    },
  });
});

// RSVP endpoints
const rsvpSchema = z.object({
  status: z.enum(["present", "absent", "maybe"]),
});

// Submit RSVP for an event (for logged-in users / families)
app.post("/api/portal/events/:eventId/rsvp/:playerId", authMiddleware, zValidator("json", rsvpSchema), async (c) => {
  const eventId = c.req.param("eventId");
  const playerId = c.req.param("playerId");
  const { status } = c.req.valid("json");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check if RSVP already exists
  const existing = await c.env.DB.prepare(
    "SELECT id FROM attendance WHERE event_id = ? AND player_id = ?"
  ).bind(eventId, playerId).first();

  if (existing) {
    // Update existing RSVP
    await c.env.DB.prepare(
      `UPDATE attendance SET status = ?, responded_by_user_id = ?, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(status, user?.id || null, existing.id).run();
    
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'updated',
      entityType: 'rsvp',
      entityId: Number(existing.id),
      entityName: `Event #${eventId}`,
      details: `Player #${playerId} - ${status}`,
    });
    
    return c.json({ success: true, updated: true });
  } else {
    // Create new RSVP
    const result = await c.env.DB.prepare(
      `INSERT INTO attendance (event_id, player_id, status, responded_by_user_id, responded_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(eventId, playerId, status, user?.id || null).run();
    
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'created',
      entityType: 'rsvp',
      entityId: Number(result.meta.last_row_id),
      entityName: `Event #${eventId}`,
      details: `Player #${playerId} - ${status}`,
    });
    
    // Send RSVP notification
    const host = c.req.header("host") || "";
    const isProduction = host.includes("mocha.app") || host.includes("capeannnoreasters.com");
    
    if (isProduction) {
      const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(eventId).first();
      const player = await c.env.DB.prepare("SELECT * FROM players WHERE id = ?").bind(playerId).first();
      
      if (event && player) {
        const eventTime = new Date(event.start_at as string).toLocaleString('en-US', { 
          timeZone: 'America/New_York',
          dateStyle: 'full',
          timeStyle: 'short'
        });
        
        const statusText = status === 'present' ? 'Attending' : status === 'absent' ? 'Not Attending' : 'Maybe';
        
        const emailHtml = `
          <h2>RSVP Request</h2>
          <p><strong>Player:</strong> ${player.first_name} ${player.last_name}</p>
          <p><strong>Status:</strong> ${statusText}</p>
          <p><strong>Event:</strong> ${event.title}</p>
          <p><strong>Date & Time:</strong> ${eventTime}</p>
          ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
          <p>Please confirm attendance for this event.</p>
          <p><a href="https://capeannnoreasters.com/portal/schedule">View Schedule & Update RSVP</a></p>
        `;
        
        const smsText = `RSVP needed for ${player.first_name} ${player.last_name}: ${event.title} on ${eventTime}. Update at capeannnoreasters.com/portal/schedule`;
        
        await sendNotifications({
          env: c.env,
          type: 'rsvp_requests',
          subject: `RSVP Request: ${event.title}`,
          emailHtml,
          smsText,
          teamId: event.team_id as number | undefined,
          familyId: player.family_id as number | undefined,
        }).catch(err => console.error('Failed to send RSVP notifications:', err));
      }
    }
    
    return c.json({ success: true, id: result.meta.last_row_id }, 201);
  }
});

// Get RSVPs for a specific event
app.get("/api/portal/events/:eventId/rsvps", authMiddleware, async (c) => {
  const eventId = c.req.param("eventId");

  const { results } = await c.env.DB.prepare(`
    SELECT 
      COALESCE(a.id, ei.id) as id,
      a.status,
      a.responded_at,
      p.id as player_id,
      p.first_name,
      p.last_name,
      f.name as family_name
    FROM event_invites ei
    JOIN players p ON ei.player_id = p.id
    JOIN families f ON p.family_id = f.id
    LEFT JOIN attendance a ON a.event_id = ei.event_id AND a.player_id = ei.player_id
    WHERE ei.event_id = ?
    ORDER BY p.last_name ASC, p.first_name ASC
  `).bind(eventId).all();

  return c.json(results);
});

// Get events for current user's family (parent view)
app.get("/api/portal/my-events", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT
      e.id,
      e.title,
      e.event_type,
      e.description,
      e.location,
      e.start_at,
      e.end_at,
      e.cost,
      t.name as team_name
    FROM events e
    LEFT JOIN teams t ON e.team_id = t.id
    JOIN event_invites ei ON ei.event_id = e.id
    JOIN players p ON p.id = ei.player_id
    JOIN families f ON f.id = p.family_id
    JOIN user_roles ur ON ur.family_id = f.id
    WHERE ur.user_id = ?
      AND LOWER(ur.role) = 'parent'
      AND e.start_at >= datetime('now')
      AND e.is_cancelled = 0
    ORDER BY e.start_at ASC
  `).bind(user.id).all();

  // Get RSVP status for each event/player combination
  const eventsWithRsvps = await Promise.all(
    (results as any[]).map(async (event) => {
      const rsvps = await c.env.DB.prepare(`
        SELECT 
          a.player_id,
          a.status
        FROM attendance a
        JOIN players p ON p.id = a.player_id
        JOIN families f ON f.id = p.family_id
        JOIN user_roles ur ON ur.family_id = f.id
        WHERE a.event_id = ? AND ur.user_id = ? AND LOWER(ur.role) = 'parent'
      `).bind(event.id, user.id).all();

      const rsvpMap: { [key: number]: string } = {};
      (rsvps.results as any[]).forEach((rsvp) => {
        rsvpMap[rsvp.player_id] = rsvp.status;
      });

      return {
        ...event,
        rsvps: rsvpMap,
      };
    })
  );

  return c.json(eventsWithRsvps);
});

// Get players for current user's family
app.get("/api/portal/my-players", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(`
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.birth_date,
      p.jersey_number
    FROM players p
    JOIN families f ON f.id = p.family_id
    JOIN user_roles ur ON ur.family_id = f.id
    WHERE ur.user_id = ? AND LOWER(ur.role) = 'parent'
    ORDER BY p.first_name ASC, p.last_name ASC
  `).bind(user.id).all();

  return c.json(results);
});

// Recruiting / Prospects endpoints

// Get all prospects
app.get("/api/portal/prospects", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check granular recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT *
    FROM prospects
    ORDER BY 
      CASE 
        WHEN next_follow_up_date IS NOT NULL THEN 0 
        ELSE 1 
      END,
      next_follow_up_date ASC,
      last_name ASC,
      first_name ASC
  `).all();

  return c.json(results);
});

// Create prospect
const createProspectSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  birth_date: z.string().nullable().optional(),
  age_group: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  parent_name: z.string().nullable().optional(),
  parent_email: z.string().nullable().optional(),
  parent_phone: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  interest_level: z.string().nullable().optional(),
  next_follow_up_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  current_team: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
});

app.post("/api/portal/prospects", authMiddleware, zValidator("json", createProspectSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const data = c.req.valid("json");

  const result = await c.env.DB.prepare(`
    INSERT INTO prospects (
      first_name, last_name, birth_date, age_group, email, phone,
      parent_name, parent_email, parent_phone, status, interest_level,
      next_follow_up_date, source, address, city, state, zip,
      current_team, position, notes, rating
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.first_name,
    data.last_name,
    data.birth_date || null,
    data.age_group || null,
    data.email || null,
    data.phone || null,
    data.parent_name || null,
    data.parent_email || null,
    data.parent_phone || null,
    data.status || null,
    data.interest_level || null,
    data.next_follow_up_date || null,
    data.source || null,
    data.address || null,
    data.city || null,
    data.state || null,
    data.zip || null,
    data.current_team || null,
    data.position || null,
    data.notes || null,
    data.rating ?? null
  ).run();

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'created',
    entityType: 'recruit',
    entityId: Number(result.meta.last_row_id),
    entityName: `${data.first_name} ${data.last_name}`,
    details: data.status || undefined,
  });

  return c.json({ id: result.meta.last_row_id, ...data }, 201);
});

// Get prospect by ID
app.get("/api/portal/prospects/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const id = c.req.param("id");
  const prospect = await c.env.DB.prepare(
    "SELECT * FROM prospects WHERE id = ?"
  ).bind(id).first();

  if (!prospect) {
    return c.json({ error: "Prospect not found" }, 404);
  }

  return c.json(prospect);
});

// Update prospect
const updateProspectSchema = createProspectSchema.partial();

app.put("/api/portal/prospects/:id", authMiddleware, zValidator("json", updateProspectSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const id = c.req.param("id");
  const data = c.req.valid("json");

  await c.env.DB.prepare(`
    UPDATE prospects SET
      first_name = COALESCE(?, first_name),
      last_name = COALESCE(?, last_name),
      birth_date = COALESCE(?, birth_date),
      age_group = COALESCE(?, age_group),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      parent_name = COALESCE(?, parent_name),
      parent_email = COALESCE(?, parent_email),
      parent_phone = COALESCE(?, parent_phone),
      status = COALESCE(?, status),
      interest_level = COALESCE(?, interest_level),
      next_follow_up_date = COALESCE(?, next_follow_up_date),
      source = COALESCE(?, source),
      address = COALESCE(?, address),
      city = COALESCE(?, city),
      state = COALESCE(?, state),
      zip = COALESCE(?, zip),
      current_team = COALESCE(?, current_team),
      position = COALESCE(?, position),
      notes = COALESCE(?, notes),
      rating = COALESCE(?, rating),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    data.first_name,
    data.last_name,
    data.birth_date,
    data.age_group,
    data.email,
    data.phone,
    data.parent_name,
    data.parent_email,
    data.parent_phone,
    data.status,
    data.interest_level,
    data.next_follow_up_date,
    data.source,
    data.address,
    data.city,
    data.state,
    data.zip,
    data.current_team,
    data.position,
    data.notes,
    data.rating,
    id
  ).run();

  // Get prospect name for logging
  const prospect = await c.env.DB.prepare(
    "SELECT first_name, last_name FROM prospects WHERE id = ?"
  ).bind(id).first();

  if (prospect) {
    await logActivity({
      db: c.env.DB,
      userId: user.id,
      userName: getUserDisplayName(user),
      action: 'updated',
      entityType: 'recruit',
      entityId: Number(id),
      entityName: `${prospect.first_name} ${prospect.last_name}`,
      details: data.status || undefined,
    });
  }

  return c.json({ success: true });
});

// Delete prospect
app.delete("/api/portal/prospects/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const id = c.req.param("id");

  // Delete notes first
  await c.env.DB.prepare("DELETE FROM prospect_notes WHERE prospect_id = ?").bind(id).run();

  // Delete prospect
  await c.env.DB.prepare("DELETE FROM prospects WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Get notes for a prospect
app.get("/api/portal/prospects/:id/notes", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const prospectId = c.req.param("id");
  const { results } = await c.env.DB.prepare(`
    SELECT *
    FROM prospect_notes
    WHERE prospect_id = ?
    ORDER BY created_at DESC
  `).bind(prospectId).all();

  return c.json(results);
});

// Add note to prospect
const createNoteSchema = z.object({
  note: z.string(),
  contact_type: z.string().optional(),
});

app.post("/api/portal/prospects/:id/notes", authMiddleware, zValidator("json", createNoteSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const prospectId = c.req.param("id");
  const data = c.req.valid("json");

  const result = await c.env.DB.prepare(`
    INSERT INTO prospect_notes (prospect_id, note, contact_type, created_by)
    VALUES (?, ?, ?, ?)
  `).bind(prospectId, data.note, data.contact_type || null, user.email).run();

  return c.json({ id: result.meta.last_row_id, ...data }, 201);
});

// Delete note
app.delete("/api/portal/prospect-notes/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Only admins and coaches can access recruiting
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');

  if (!adminCheck && !isCoach) {
    return c.json({ error: "Forbidden - recruiting access is restricted to admins and coaches" }, 403);
  }

  // Check recruiting permissions
  const recruitingAccess = await checkRecruitingAccess(c.env.DB, user.id);
  if (!recruitingAccess.allowed) {
    return c.json({ error: recruitingAccess.reason || "Recruiting access denied" }, 403);
  }

  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM prospect_notes WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// ============ UNIFORM ORDERS ============

const uniformOrderSchema = z.object({
  player_id: z.number(),
  team_id: z.number().nullable().optional(),
  jersey_material: z.string().optional(),
  jersey_type: z.string().optional(),
  jersey_size: z.string().optional(),
  jersey_number: z.string().optional(),
  jersey_name: z.string().optional(),
  jersey_color: z.string().optional(),
  shorts_size: z.string().optional(),
  shorts_material: z.string().optional(),
  is_female: z.boolean().optional(),
  leggings_size: z.string().optional(),
  fleece_hoodie_size: z.string().optional(),
  fleece_hoodie_color: z.string().optional(),
  fleece_joggers_size: z.string().optional(),
  fleece_joggers_color: z.string().optional(),
  backpack_size: z.string().optional(),
  has_flag_sets: z.boolean().optional(),
  duffle_bag_size: z.string().optional(),
  drawstring_bags_qty: z.number().optional(),
  arm_sleeves_qty: z.number().optional(),
  bomber_jacket_qty: z.number().optional(),
  combo_total: z.number().optional(),
  addons_total: z.number().optional(),
  items_total: z.number().optional(),
  order_total: z.number().optional(),
  comments: z.string().optional(),
});

// Create uniform order
app.post("/api/portal/uniform-orders", authMiddleware, zValidator("json", uniformOrderSchema), async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const data = c.req.valid("json");
  const now = new Date().toISOString();

  // Get player info to find family_id
  const player = await c.env.DB.prepare(
    "SELECT id, first_name, last_name, family_id FROM players WHERE id = ?"
  ).bind(data.player_id).first();

  if (!player) {
    return c.json({ error: "Player not found" }, 404);
  }

  // Create the uniform order
  const orderResult = await c.env.DB.prepare(`
    INSERT INTO uniform_orders (
      player_id, team_id, status,
      jersey_material, jersey_type, jersey_size, jersey_number, jersey_name, jersey_color,
      shorts_size, shorts_material, is_female,
      leggings_size, fleece_hoodie_size, fleece_hoodie_color, fleece_joggers_size, fleece_joggers_color, backpack_size, has_flag_sets,
      duffle_bag_size, drawstring_bags_qty, arm_sleeves_qty, bomber_jacket_qty,
      combo_total, addons_total, items_total, order_total,
      comments, ordered_by_user_id, submitted_at, created_at, updated_at
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.player_id,
    data.team_id || null,
    data.jersey_material || null,
    data.jersey_type || null,
    data.jersey_size || null,
    data.jersey_number || null,
    data.jersey_name || null,
    data.jersey_color || null,
    data.shorts_size || null,
    data.shorts_material || null,
    data.is_female ? 1 : 0,
    data.leggings_size || null,
    data.fleece_hoodie_size || null,
    data.fleece_hoodie_color || null,
    data.fleece_joggers_size || null,
    data.fleece_joggers_color || null,
    data.backpack_size || null,
    data.has_flag_sets ? 1 : 0,
    data.duffle_bag_size || null,
    data.drawstring_bags_qty || 0,
    data.arm_sleeves_qty || 0,
    data.bomber_jacket_qty || 0,
    data.combo_total || 0,
    data.addons_total || 0,
    data.items_total || 0,
    data.order_total || 0,
    data.comments || null,
    user.id,
    now,
    now,
    now
  ).run();

  const orderId = orderResult.meta.last_row_id;

  // Create a payment/due for this order if total > 0
  if (data.order_total && data.order_total > 0) {
    const paymentResult = await c.env.DB.prepare(`
      INSERT INTO payments (
        family_id, description, payment_type, amount, total_amount, due_date,
        team_id, created_at, updated_at
      ) VALUES (?, ?, 'fixed', ?, ?, ?, ?, ?, ?)
    `).bind(
      player.family_id,
      `Uniform Order - ${player.first_name} ${player.last_name}`,
      data.order_total,
      data.order_total,
      null,
      data.team_id || null,
      now,
      now
    ).run();

    const paymentId = paymentResult.meta.last_row_id;

    // Create player_payment entry
    await c.env.DB.prepare(`
      INSERT INTO player_payments (
        payment_id, player_id, amount, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'unpaid', ?, ?)
    `).bind(paymentId, data.player_id, data.order_total, now, now).run();

    // Update uniform order with payment_id
    await c.env.DB.prepare(
      "UPDATE uniform_orders SET payment_id = ? WHERE id = ?"
    ).bind(paymentId, orderId).run();
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'created',
    entityType: 'uniform_order',
    entityId: Number(orderId),
    entityName: `${player.first_name} ${player.last_name}`,
    teamId: data.team_id || undefined,
    familyId: Number(player.family_id),
    details: `$${data.order_total || 0}`,
  });

  return c.json({ id: orderId, success: true }, 201);
});

// Get all uniform orders (admin)
app.get("/api/portal/uniform-orders", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const teamId = c.req.query("team_id");
  const status = c.req.query("status");

  // Check user's role
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  let query = `
    SELECT uo.*, 
           p.first_name, p.last_name,
           t.name as team_name,
           pp.status as payment_status
    FROM uniform_orders uo
    LEFT JOIN players p ON uo.player_id = p.id
    LEFT JOIN teams t ON uo.team_id = t.id
    LEFT JOIN player_payments pp ON uo.payment_id = pp.payment_id AND uo.player_id = pp.player_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Role-based filtering
  if (!adminCheck) {
    if (isParent && familyId) {
      // Parents only see their family's orders
      query += " AND p.family_id = ?";
      params.push(familyId);
    } else if (isCoach) {
      // Coaches only see orders for their teams
      query += ` AND uo.team_id IN (${coachTeamIds.map(() => '?').join(',')})`;
      params.push(...coachTeamIds);
    }
  }

  if (teamId) {
    query += " AND uo.team_id = ?";
    params.push(teamId);
  }
  if (status) {
    query += " AND uo.status = ?";
    params.push(status);
  }

  query += " ORDER BY uo.created_at DESC";

  const stmt = c.env.DB.prepare(query);
  const { results } = params.length > 0 
    ? await stmt.bind(...params).all()
    : await stmt.all();

  return c.json(results);
});

// Update uniform order status
app.put("/api/portal/uniform-orders/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  // Check user's role
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Verify access to this order
  const order = await c.env.DB.prepare(
    `SELECT uo.*, p.family_id 
     FROM uniform_orders uo
     LEFT JOIN players p ON uo.player_id = p.id
     WHERE uo.id = ?`
  ).bind(id).first();

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  if (!adminCheck) {
    if (familyId && (order as any).family_id !== familyId) {
      // Parents can only update their own family's orders
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach && !coachTeamIds.includes((order as any).team_id)) {
      // Coaches can only update orders for their teams
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE uniform_orders SET status = ?, updated_at = ? WHERE id = ?"
  ).bind(body.status, now, id).run();

  return c.json({ success: true });
});

// Delete uniform order
app.delete("/api/portal/uniform-orders/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  // Check user's role
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  // Get the order to find payment_id and verify access
  const orderWithFamily = await c.env.DB.prepare(
    `SELECT uo.*, p.family_id 
     FROM uniform_orders uo
     LEFT JOIN players p ON uo.player_id = p.id
     WHERE uo.id = ?`
  ).bind(id).first();

  if (!orderWithFamily) {
    return c.json({ error: "Order not found" }, 404);
  }

  if (!adminCheck) {
    if (familyId && (orderWithFamily as any).family_id !== familyId) {
      // Parents can only delete their own family's orders
      return c.json({ error: "Forbidden" }, 403);
    } else if (isCoach && !coachTeamIds.includes((orderWithFamily as any).team_id)) {
      // Coaches can only delete orders for their teams
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  if ((orderWithFamily as any).payment_id) {
    // Delete player_payment
    await c.env.DB.prepare(
      "DELETE FROM player_payments WHERE payment_id = ? AND player_id = ?"
    ).bind((orderWithFamily as any).payment_id, (orderWithFamily as any).player_id).run();
    // Delete payment
    await c.env.DB.prepare(
      "DELETE FROM payments WHERE id = ?"
    ).bind((orderWithFamily as any).payment_id).run();
  }

  await c.env.DB.prepare("DELETE FROM uniform_orders WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Survey endpoints
app.post("/api/portal/surveys", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check if user can create surveys (admins, coaches, parents)
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck && !isCoach && !isParent) {
    return c.json({ error: "Forbidden - you do not have permission to create surveys" }, 403);
  }

  const body = await c.req.json();

  // Validate team access for non-admins
  if (!adminCheck && body.team_ids && body.team_ids.length > 0) {
    if (isCoach) {
      // Coaches can only create surveys for their teams
      const invalidTeams = body.team_ids.filter((tid: number) => !coachTeamIds.includes(tid));
      if (invalidTeams.length > 0) {
        return c.json({ error: "You can only create surveys for teams you coach" }, 403);
      }
    } else if (isParent && familyId) {
      // Parents can only create surveys for teams their children are on
      const playerTeams = await c.env.DB.prepare(
        `SELECT DISTINCT tp.team_id 
         FROM team_players tp
         JOIN players p ON tp.player_id = p.id
         WHERE p.family_id = ?`
      ).bind(familyId).all();
      
      const allowedTeamIds = (playerTeams.results || []).map((t: any) => t.team_id);
      const invalidTeams = body.team_ids.filter((tid: number) => !allowedTeamIds.includes(tid));
      if (invalidTeams.length > 0) {
        return c.json({ error: "You can only create surveys for your children's teams" }, 403);
      }
    }
  }

  const now = new Date().toISOString();

  // Create survey
  const surveyResult = await c.env.DB.prepare(`
    INSERT INTO surveys (
      title, description, target_type, team_ids, expires_at, 
      is_active, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    body.title,
    body.description || null,
    body.target_type,
    body.team_ids ? JSON.stringify(body.team_ids) : null,
    body.expires_at || null,
    user.id,
    now,
    now
  ).run();

  const surveyId = surveyResult.meta.last_row_id;

  // Create questions
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    await c.env.DB.prepare(`
      INSERT INTO survey_questions (
        survey_id, question_text, question_type, options, 
        is_required, order_index, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      surveyId,
      q.question_text,
      q.question_type,
      q.options || null,
      q.is_required ? 1 : 0,
      i,
      now,
      now
    ).run();
  }

  // Create recipients
  if (body.target_type === "all") {
    // Get all families
    const { results: families } = await c.env.DB.prepare(
      "SELECT id FROM families"
    ).all();
    
    for (const family of families as any[]) {
      await c.env.DB.prepare(`
        INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).bind(surveyId, family.id, now, now).run();
    }
  } else if (body.target_type === "team" && body.team_ids?.length > 0) {
    // Get families with players on selected teams
    const placeholders = body.team_ids.map(() => "?").join(",");
    const { results: families } = await c.env.DB.prepare(`
      SELECT DISTINCT p.family_id
      FROM players p
      JOIN team_players tp ON p.id = tp.player_id
      WHERE tp.team_id IN (${placeholders})
    `).bind(...body.team_ids).all();
    
    for (const family of families as any[]) {
      await c.env.DB.prepare(`
        INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).bind(surveyId, family.id, now, now).run();
    }
  } else if (body.target_type === "custom") {
    // Add specific families
    if (body.family_ids?.length > 0) {
      for (const familyId of body.family_ids) {
        await c.env.DB.prepare(`
          INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `).bind(surveyId, familyId, now, now).run();
      }
    }
    
    // Add specific players
    if (body.player_ids?.length > 0) {
      for (const playerId of body.player_ids) {
        await c.env.DB.prepare(`
          INSERT INTO survey_recipients (survey_id, player_id, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `).bind(surveyId, playerId, now, now).run();
      }
    }
  }

  await logActivity({
    db: c.env.DB,
    userId: user.id,
    userName: getUserDisplayName(user),
    action: 'created',
    entityType: 'survey',
    entityId: Number(surveyId),
    entityName: body.title,
    details: `${body.target_type} - ${body.questions.length} questions`,
  });

  return c.json({ id: surveyId, success: true }, 201);
});

app.get("/api/portal/surveys", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check user's role
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const isParent = roles.some(r => r.role === 'Parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  const { results: allSurveys } = await c.env.DB.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM survey_recipients WHERE survey_id = s.id) as recipient_count,
      (SELECT COUNT(*) FROM survey_responses WHERE survey_id = s.id) as response_count
    FROM surveys s
    ORDER BY s.created_at DESC
  `).all();

  // Filter surveys based on role
  let surveys = allSurveys;
  if (!adminCheck) {
    surveys = (allSurveys as any[]).filter((survey: any) => {
      if (!survey.team_ids) return false;
      
      const surveyTeamIds = JSON.parse(survey.team_ids);
      
      if (isCoach) {
        // Coaches see surveys for their teams
        return surveyTeamIds.some((tid: number) => coachTeamIds.includes(tid));
      } else if (isParent && familyId) {
        // Parents see surveys they created or for their children's teams
        // For now, just check if created by them - team filtering would need async lookup
        return survey.created_by_user_id === user.id;
      }
      return false;
    });
  }

  return c.json(surveys);
});

app.get("/api/portal/surveys/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  const survey = await c.env.DB.prepare(
    "SELECT * FROM surveys WHERE id = ?"
  ).bind(id).first();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  // Check if user is a recipient
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyIds = roles.filter(r => r.family_id).map(r => r.family_id!);
  
  const { results: recipients } = await c.env.DB.prepare(`
    SELECT * FROM survey_recipients 
    WHERE survey_id = ? AND (family_id IN (${familyIds.map(() => '?').join(',')}) OR player_id IN (
      SELECT id FROM players WHERE family_id IN (${familyIds.map(() => '?').join(',')})
    ))
  `).bind(id, ...familyIds, ...familyIds).all();

  const isRecipient = recipients.length > 0;
  const isCreator = (survey as any).created_by_user_id === user.id;

  // Non-admins must be recipients or creators to view
  if (!adminCheck && !isRecipient && !isCreator) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const { results: questions } = await c.env.DB.prepare(
    "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_index"
  ).bind(id).all();

  // Check if user already responded
  let alreadyResponded = false;
  if (familyIds.length > 0) {
    const existingResponse = await c.env.DB.prepare(`
      SELECT id FROM survey_responses 
      WHERE survey_id = ? AND (
        family_id IN (${familyIds.map(() => '?').join(',')}) OR 
        submitted_by_user_id = ?
      )
      LIMIT 1
    `).bind(id, ...familyIds, user.id).first();
    alreadyResponded = !!existingResponse;
  }

  return c.json({ 
    survey, 
    questions,
    already_responded: alreadyResponded
  });
});

app.delete("/api/portal/surveys/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  // Get survey to check ownership/access
  const survey = await c.env.DB.prepare(
    "SELECT * FROM surveys WHERE id = ?"
  ).bind(id).first();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  // Check access - only creator, admins, or coaches of the teams can delete
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  const canDelete = adminCheck || 
                    (survey as any).created_by_user_id === user.id ||
                    (isCoach && (survey as any).team_ids && JSON.parse((survey as any).team_ids).some((tid: number) => coachTeamIds.includes(tid)));

  if (!canDelete) {
    return c.json({ error: "Forbidden - you can only delete your own surveys or surveys for teams you coach" }, 403);
  }

  // Delete in reverse order of dependencies
  await c.env.DB.prepare("DELETE FROM survey_answers WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id = ?)").bind(id).run();
  await c.env.DB.prepare("DELETE FROM survey_responses WHERE survey_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM survey_recipients WHERE survey_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM survey_questions WHERE survey_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM surveys WHERE id = ?").bind(id).run();

  return c.json({ success: true });
});

// Submit survey response
app.post("/api/portal/surveys/:id/response", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const { answers } = await c.req.json();

  const survey = await c.env.DB.prepare(
    "SELECT * FROM surveys WHERE id = ?"
  ).bind(id).first();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  if (!(survey as any).is_active) {
    return c.json({ error: "Survey is closed" }, 400);
  }

  if ((survey as any).expires_at && new Date((survey as any).expires_at) < new Date()) {
    return c.json({ error: "Survey has expired" }, 400);
  }

  // Get user's family
  const roles = await getUserRoles(c.env.DB, user.id);
  const familyIds = roles.filter(r => r.family_id).map(r => r.family_id!);
  const familyId = familyIds.length > 0 ? familyIds[0] : null;

  // Check if already responded
  if (familyId) {
    const existingResponse = await c.env.DB.prepare(`
      SELECT id FROM survey_responses 
      WHERE survey_id = ? AND (family_id = ? OR submitted_by_user_id = ?)
      LIMIT 1
    `).bind(id, familyId, user.id).first();

    if (existingResponse) {
      return c.json({ error: "You have already responded to this survey" }, 400);
    }
  }

  const now = new Date().toISOString();

  // Create response
  const responseResult = await c.env.DB.prepare(`
    INSERT INTO survey_responses (
      survey_id, family_id, submitted_by_user_id, submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, familyId, user.id, now, now, now).run();

  const responseId = responseResult.meta.last_row_id;

  // Insert answers
  for (const [questionId, answerText] of Object.entries(answers)) {
    if (answerText && String(answerText).trim()) {
      await c.env.DB.prepare(`
        INSERT INTO survey_answers (
          response_id, question_id, answer_text, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(responseId, parseInt(questionId), String(answerText), now, now).run();
    }
  }

  return c.json({ success: true, response_id: responseId });
});

app.get("/api/portal/surveys/:id/results", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  const survey = await c.env.DB.prepare(
    "SELECT * FROM surveys WHERE id = ?"
  ).bind(id).first();

  if (!survey) {
    return c.json({ error: "Survey not found" }, 404);
  }

  // Check access
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'Coach');
  const coachTeamIds = roles.filter(r => r.role === 'Coach' && r.team_id).map(r => r.team_id!);

  if (!adminCheck) {
    const surveyTeamIds = (survey as any).team_ids ? JSON.parse((survey as any).team_ids) : [];
    
    if (isCoach) {
      // Check if coach has access to at least one team in the survey
      const hasAccess = surveyTeamIds.some((tid: number) => coachTeamIds.includes(tid));
      if (!hasAccess && (survey as any).created_by_user_id !== user.id) {
        return c.json({ error: "Forbidden" }, 403);
      }
    } else if ((survey as any).created_by_user_id !== user.id) {
      // Non-coaches can only see results if they created the survey
      return c.json({ error: "Forbidden - only survey creators and coaches can view results" }, 403);
    }
  }

  const { results: questions } = await c.env.DB.prepare(
    "SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_index"
  ).bind(id).all();

  const { results: responses } = await c.env.DB.prepare(`
    SELECT sr.*, 
           f.name as family_name,
           p.first_name, p.last_name
    FROM survey_responses sr
    LEFT JOIN families f ON sr.family_id = f.id
    LEFT JOIN players p ON sr.player_id = p.id
    WHERE sr.survey_id = ?
    ORDER BY sr.submitted_at DESC
  `).bind(id).all();

  // Get answers for each response
  for (const response of responses as any[]) {
    const { results: answers } = await c.env.DB.prepare(`
      SELECT sa.*, sq.question_text, sq.question_type
      FROM survey_answers sa
      JOIN survey_questions sq ON sa.question_id = sq.id
      WHERE sa.response_id = ?
      ORDER BY sq.order_index
    `).bind(response.id).all();
    
    response.answers = answers;
  }

  return c.json({
    survey,
    questions,
    responses
  });
});

app.get("/api/portal/families", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email FROM families ORDER BY name"
  ).all();

  return c.json(results);
});

// Document endpoints
app.get("/api/portal/documents", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'coach');
  const isParent = roles.some(r => r.role === 'parent');
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);

  let query = `
    SELECT td.*, 
           t.name as team_name,
           f.name as family_name
    FROM team_documents td
    LEFT JOIN teams t ON td.team_id = t.id
    LEFT JOIN families f ON td.family_id = f.id
  `;
  const conditions: string[] = [];
  const values: any[] = [];

  if (adminCheck) {
    // Admins see all documents
  } else if (isCoach) {
    // Coaches see documents from teams they coach
    const coachTeamIds = roles.filter(r => r.role === 'coach' && r.team_id).map(r => r.team_id);
    if (coachTeamIds.length > 0) {
      const placeholders = coachTeamIds.map(() => "?").join(",");
      conditions.push(`td.team_id IN (${placeholders})`);
      values.push(...coachTeamIds);
    } else {
      // Coach with no teams assigned
      conditions.push("1 = 0");
    }
  } else if (isParent && familyId) {
    // Parents see only their family's documents
    conditions.push("td.family_id = ?");
    values.push(familyId);
  } else {
    // No access
    conditions.push("1 = 0");
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += " ORDER BY td.created_at DESC";

  const { results } = await c.env.DB.prepare(query).bind(...values).all();
  return c.json(results);
});

app.post("/api/portal/documents", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  // Check document upload permissions
  const canUpload = await canUploadDocuments(c.env.DB, user.id);
  if (!canUpload) {
    return c.json({ error: "Document upload access denied" }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const teamId = formData.get("team_id") as string;

  if (!file || !title || !teamId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  if (!familyId) {
    return c.json({ error: "No family associated with user" }, 403);
  }

  // Use the file's actual content type from the upload, or fallback to extension-based detection
  const getContentType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    const types: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    return types[ext || ''] || 'application/octet-stream';
  };

  // Determine content type - prefer the file's type property, fallback to extension
  const contentType = file.type || getContentType(file.name);
  
  // Debug logging
  console.log('Upload Debug:', {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    detectedContentType: contentType
  });
  
  // Get file content as array buffer
  const fileBuffer = await file.arrayBuffer();
  
  console.log('Buffer size:', fileBuffer.byteLength);
  
  // Upload file to R2
  const fileKey = `documents/${teamId}/${Date.now()}-${file.name}`;
  await c.env.R2_BUCKET.put(fileKey, fileBuffer, {
    httpMetadata: {
      contentType: contentType,
    },
  });
  
  console.log('Uploaded to R2 with content type:', contentType);

  // Save to database
  const result = await c.env.DB.prepare(`
    INSERT INTO team_documents (team_id, family_id, title, description, file_key, file_name, file_size, uploaded_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(teamId, familyId, title, description, fileKey, file.name, file.size, user.id).run();

  return c.json({ success: true, id: result.meta.last_row_id });
});

app.get("/api/portal/documents/:id/download", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const docId = c.req.param("id");

  // Get document info
  const doc = await c.env.DB.prepare(
    "SELECT * FROM team_documents WHERE id = ?"
  ).bind(docId).first() as any;

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Check permissions
  const roles = await getUserRoles(c.env.DB, user.id);
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const isCoach = roles.some(r => r.role === 'coach' && r.team_id === doc.team_id);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const isOwner = doc.family_id && doc.family_id === familyId;

  if (!adminCheck && !isCoach && !isOwner) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Check document download permissions
  const canDownload = await canDownloadDocuments(c.env.DB, user.id);
  if (!canDownload) {
    return c.json({ error: "Document download access denied" }, 403);
  }

  // Get file from R2
  const object = await c.env.R2_BUCKET.get(doc.file_key);
  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  // Use stored content type from R2 metadata, or fallback to extension-based detection
  const getContentType = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    const types: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    return types[ext || ''] || 'application/octet-stream';
  };

  const contentType = object.httpMetadata?.contentType || getContentType(doc.file_name);
  
  // Debug logging
  console.log('Download Debug:', {
    fileName: doc.file_name,
    fileKey: doc.file_key,
    objectSize: object.size,
    storedContentType: object.httpMetadata?.contentType,
    finalContentType: contentType
  });

  // Use a simple ASCII-safe filename for the header
  const safeFileName = doc.file_name.replace(/[^\x20-\x7E]/g, '_');

  // Return the R2 object body directly as a stream - more efficient and reliable
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "Content-Length": object.size.toString(),
      "Cache-Control": "no-cache",
    },
  });
});

app.delete("/api/portal/documents/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const docId = c.req.param("id");

  // Get document info
  const doc = await c.env.DB.prepare(
    "SELECT * FROM team_documents WHERE id = ?"
  ).bind(docId).first() as any;

  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  // Check permissions - only admin or document owner can delete
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  const familyId = await getFamilyIdForUser(c.env.DB, user.id);
  const isOwner = doc.family_id && doc.family_id === familyId;

  if (!adminCheck && !isOwner) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Delete from R2
  await c.env.R2_BUCKET.delete(doc.file_key);

  // Delete from database
  await c.env.DB.prepare("DELETE FROM team_documents WHERE id = ?").bind(docId).run();

  return c.json({ success: true });
});

// ============ Database Admin Endpoints ============

// List all tables with row counts
app.get("/api/portal/admin/tables", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tables = [
    "boards", "reservations", "admins", "seasons", "teams", "families", "players",
    "team_players", "events", "attendance", "payments", "event_invites",
    "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
    "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
    "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
    "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
    "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
    "site_config", "user_permissions"
  ];

  const tableData = await Promise.all(
    tables.map(async (name) => {
      try {
        const result = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM ${name}`).first() as any;
        return { name, count: result?.count || 0 };
      } catch {
        return { name, count: 0 };
      }
    })
  );

  return c.json({ tables: tableData });
});

// Get table data with pagination
app.get("/api/portal/admin/tables/:table", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tableName = c.req.param("table");
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = parseInt(c.req.query("pageSize") || "25");
  const search = c.req.query("search") || "";
  const offset = (page - 1) * pageSize;

  // Validate table name (prevent SQL injection)
  const allowedTables = [
    "boards", "reservations", "admins", "seasons", "teams", "families", "players",
    "team_players", "events", "attendance", "payments", "event_invites",
    "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
    "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
    "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
    "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
    "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
    "site_config", "user_permissions"
  ];

  if (!allowedTables.includes(tableName)) {
    return c.json({ error: "Invalid table name" }, 400);
  }

  try {
    // Get column info
    const pragmaResult = await c.env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
    const columns = (pragmaResult.results as any[]).map((col: any) => ({
      name: col.name,
      type: col.type,
    }));

    // Special handling for tables with foreign keys to show related data
    let additionalColumns: Array<{ name: string; type: string }> = [];
    
    if (tableName === "players") {
      additionalColumns.push({ name: "family_name", type: "TEXT" });
    }

    // Get total count
    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).first() as any;
    const total = countResult?.count || 0;

    // Get rows with optional search
    let query = `SELECT ${tableName}.*`;
    
    // Add additional columns for joins
    if (tableName === "players") {
      query += `, families.name as family_name FROM ${tableName} LEFT JOIN families ON ${tableName}.family_id = families.id`;
    } else {
      query += ` FROM ${tableName}`;
    }
    
    const params: any[] = [];

    if (search) {
      const searchConditions = columns
        .filter((col) => col.type.toLowerCase().includes("text") || col.type.toLowerCase().includes("varchar"))
        .map((col) => `${col.name} LIKE ?`)
        .join(" OR ");
      
      if (searchConditions) {
        query += ` WHERE ${searchConditions}`;
        columns
          .filter((col) => col.type.toLowerCase().includes("text") || col.type.toLowerCase().includes("varchar"))
          .forEach(() => params.push(`%${search}%`));
      }
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    const result = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({
      columns: [...columns, ...additionalColumns],
      rows: result.results,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Database admin error:", error);
    return c.json({ error: "Failed to fetch table data" }, 500);
  }
});

// Update a row
app.put("/api/portal/admin/tables/:table/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tableName = c.req.param("table");
  const id = c.req.param("id");

  // Validate table name
  const allowedTables = [
    "boards", "reservations", "admins", "seasons", "teams", "families", "players",
    "team_players", "events", "attendance", "payments", "event_invites",
    "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
    "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
    "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
    "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
    "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
    "site_config", "user_permissions"
  ];

  if (!allowedTables.includes(tableName)) {
    return c.json({ error: "Invalid table name" }, 400);
  }

  try {
    const body = await c.req.json();
    
    // Remove id and computed columns from update fields
    delete body.id;
    delete body.family_name; // Computed column from JOIN
    
    // Update updated_at if the column exists
    body.updated_at = new Date().toISOString();

    const keys = Object.keys(body);
    const setClause = keys.map((key) => `${key} = ?`).join(", ");
    const values = keys.map((key) => body[key] === "" ? null : body[key]);

    await c.env.DB.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error("Database admin update error:", error);
    return c.json({ error: "Failed to update row" }, 500);
  }
});

// Delete a row
app.delete("/api/portal/admin/tables/:table/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tableName = c.req.param("table");
  const id = c.req.param("id");

  // Validate table name
  const allowedTables = [
    "boards", "reservations", "admins", "seasons", "teams", "families", "players",
    "team_players", "events", "attendance", "payments", "event_invites",
    "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
    "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
    "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
    "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
    "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
    "site_config", "user_permissions"
  ];

  if (!allowedTables.includes(tableName)) {
    return c.json({ error: "Invalid table name" }, 400);
  }

  try {
    await c.env.DB.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error("Database admin delete error:", error);
    return c.json({ error: "Failed to delete row" }, 500);
  }
});

// Create a row
app.post("/api/portal/admin/tables/:table", authMiddleware, async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  
  const adminCheck = await isAdmin(c.env.DB, user.id, user.email);
  if (!adminCheck) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const tableName = c.req.param("table");

  // Validate table name
  const allowedTables = [
    "boards", "reservations", "admins", "seasons", "teams", "families", "players",
    "team_players", "events", "attendance", "payments", "event_invites",
    "calendar_subscriptions", "team_coaches", "team_documents", "player_payments",
    "prospects", "prospect_notes", "uniform_orders", "team_seasons", "surveys",
    "survey_questions", "survey_recipients", "survey_responses", "survey_answers",
    "user_roles", "invites", "activity_log", "tryout_config", "coaches_documents",
    "coaches_messages", "coaches_message_replies", "team_messages", "team_message_replies",
    "site_config", "user_permissions"
  ];

  if (!allowedTables.includes(tableName)) {
    return c.json({ error: "Invalid table name" }, 400);
  }

  try {
    const body = await c.req.json();
    
    // Add timestamps
    body.created_at = new Date().toISOString();
    body.updated_at = new Date().toISOString();

    // Filter out empty string values, convert to null
    const filteredBody: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== "") {
        filteredBody[key] = value;
      }
    }

    const keys = Object.keys(filteredBody);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(filteredBody);

    const result = await c.env.DB.prepare(
      `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`
    )
      .bind(...values)
      .run();

    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error("Database admin create error:", error);
    return c.json({ error: "Failed to create row" }, 500);
  }
});

// Setup role management endpoints
setupRoleEndpoints(app, authMiddleware, requireAdmin);

// Setup invite management endpoints
setupInviteEndpoints(app, authMiddleware, requireAdmin);

// Setup activity log endpoints
setupActivityEndpoints(app, authMiddleware);

// Setup coaches corner endpoints
setupCoachesEndpoints(app, authMiddleware);

// Setup team message endpoints
setupTeamMessageEndpoints(app, authMiddleware);

// Setup news endpoints
setupNewsEndpoints(app, authMiddleware);

// Setup group message endpoints
setupGroupMessageEndpoints(app, authMiddleware, requireAdmin);
setupPaymentEmailEndpoints(app, authMiddleware, requireAdmin);

// Setup contacts endpoints
setupContactsEndpoints(app, authMiddleware);

// Setup notification preferences endpoints
setupNotificationPreferencesEndpoints(app, authMiddleware);

// Setup raffle endpoints
setupRaffleEndpoints(app);

// Setup contact endpoints
setupContactEndpoints(app);

// Setup gallery endpoints - public routes handle their own auth
app.route("/api/gallery", galleryEndpoints);

// Setup public coaches endpoints
app.route("/api/public/coaches", coachesPublicEndpoints);

// Test SMS endpoint (admin only)
app.post("/api/test-sms", authMiddleware, requireAdmin, async (c) => {
  const body = await c.req.json();
  const { phone, message } = body;
  
  if (!phone || !message) {
    return c.json({ error: "Phone and message required" }, 400);
  }
  
  try {
    const result = await sendTestSMS(c.env, phone, message);
    
    // Log success
    await c.env.DB.prepare(
      `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, created_at, updated_at)
       VALUES (?, 'test', 'sms', ?, 'success', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(c.get("user")?.id || 'test', phone).run();
    
    return c.json({ success: true, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log failure
    await c.env.DB.prepare(
      `INSERT INTO notification_logs (user_id, notification_type, delivery_method, recipient, status, error_message, created_at, updated_at)
       VALUES (?, 'test', 'sms', ?, 'failed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(c.get("user")?.id || 'test', phone, errorMessage).run();
    
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// Setup public teams endpoints
app.route("/api/public/teams", teamsPublicEndpoints);

export default app;
