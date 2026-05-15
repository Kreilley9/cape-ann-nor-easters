import { Hono } from "hono";
import type { Env } from "@/shared/types";

// Email template helper functions
const emailTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f4f4f5; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;">
    ${content}
  </div>
</body>
</html>
`;

const emailHeader = (title: string) => `
<div style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #e4e4e7;">
  <img src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png" alt="Cape Ann Nor'easters" style="width: 60px; height: 60px; margin-bottom: 16px;">
  <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">${title}</h1>
</div>
`;

const emailBody = (content: string) => `
<div style="padding: 32px 40px;">
  ${content}
</div>
`;

const emailFooter = () => `
<div style="padding: 24px 40px; border-top: 1px solid #e4e4e7; background-color: #f9fafb;">
  <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
    Cape Ann Nor'easters Youth Flag Football Club<br>
    <a href="https://capeannnoreasters.com" style="color: #00c4ff;">capeannnoreasters.com</a>
  </p>
</div>
`;

// Helper to check if user is admin
async function isUserAdmin(db: D1Database, userId: string, email: string): Promise<boolean> {
  const adminCheck = await db.prepare(
    "SELECT id FROM admins WHERE email = ?"
  ).bind(email).first();
  if (adminCheck) return true;
  
  const roleCheck = await db.prepare(
    "SELECT id FROM user_roles WHERE user_id = ? AND LOWER(role) = 'admin'"
  ).bind(userId).first();
  return !!roleCheck;
}

// Helper to get coach's team IDs
async function getCoachTeamIds(db: D1Database, userId: string): Promise<number[]> {
  const roles = await db.prepare(
    "SELECT team_id FROM user_roles WHERE user_id = ? AND LOWER(role) = 'coach' AND team_id IS NOT NULL"
  ).bind(userId).all();
  return (roles.results || []).map((r: any) => r.team_id as number);
}

// Calculate age from birth date
function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function setupContactsEndpoints(
  app: Hono<{ Bindings: Env }>,
  authMiddleware: any
) {
  // Get all contacts for the user based on their role
  app.get("/api/portal/contacts", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const isAdmin = await isUserAdmin(c.env.DB, user.id, user.email);
      const coachTeamIds = await getCoachTeamIds(c.env.DB, user.id);
      
      if (!isAdmin && coachTeamIds.length === 0) {
        return c.json([]);
      }

      const contacts: any[] = [];

      // 1. Get coaches (for admin: all coaches, for coach: coaches on their teams)
      let coachQuery = `
        SELECT DISTINCT
          'coach-' || ur.id as id,
          ur.name as name,
          ur.email as email,
          NULL as phone,
          'coach' as role,
          NULL as status,
          NULL as birth_date,
          ur.team_id as team_id,
          t.name as team_name,
          NULL as family_id,
          NULL as family_name,
          NULL as position
        FROM user_roles ur
        LEFT JOIN teams t ON ur.team_id = t.id
        WHERE LOWER(ur.role) = 'coach'
      `;
      
      if (!isAdmin) {
        const placeholders = coachTeamIds.map(() => "?").join(",");
        coachQuery += ` AND ur.team_id IN (${placeholders})`;
        const coachResults = await c.env.DB.prepare(coachQuery).bind(...coachTeamIds).all();
        contacts.push(...(coachResults.results || []));
      } else {
        const coachResults = await c.env.DB.prepare(coachQuery).all();
        contacts.push(...(coachResults.results || []));
      }

      // 2. Get players/parents (for admin: all, for coach: on their teams)
      let playerQuery = `
        SELECT DISTINCT
          'player-' || p.id as id,
          p.first_name || ' ' || p.last_name as name,
          COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
          COALESCE(p.parent_1_phone, p.parent_2_phone) as phone,
          'player' as role,
          p.status as status,
          p.birth_date as birth_date,
          tp.team_id as team_id,
          t.name as team_name,
          p.family_id as family_id,
          f.name as family_name,
          NULL as position
        FROM players p
        LEFT JOIN families f ON p.family_id = f.id
        LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
        LEFT JOIN teams t ON tp.team_id = t.id
      `;
      
      if (!isAdmin) {
        const placeholders = coachTeamIds.map(() => "?").join(",");
        playerQuery += ` WHERE tp.team_id IN (${placeholders})`;
        const playerResults = await c.env.DB.prepare(playerQuery).bind(...coachTeamIds).all();
        contacts.push(...(playerResults.results || []));
      } else {
        const playerResults = await c.env.DB.prepare(playerQuery).all();
        contacts.push(...(playerResults.results || []));
      }

      // 3. Get recruits/prospects (for admin: all, for coach: based on permissions)
      // First check if user has recruiting access
      let hasRecruitingAccess = isAdmin;
      if (!isAdmin) {
        const permCheck = await c.env.DB.prepare(
          "SELECT permission_value FROM user_permissions WHERE user_id = ? AND permission_key = 'recruiting_access'"
        ).bind(user.id).first();
        hasRecruitingAccess = permCheck && (permCheck as any).permission_value === "1";
      }

      if (hasRecruitingAccess) {
        const prospectQuery = `
          SELECT DISTINCT
            'prospect-' || p.id as id,
            p.first_name || ' ' || p.last_name as name,
            COALESCE(p.parent_email, p.email) as email,
            COALESCE(p.parent_phone, p.phone) as phone,
            'prospect' as role,
            p.interest_level as status,
            p.birth_date as birth_date,
            NULL as team_id,
            NULL as team_name,
            NULL as family_id,
            NULL as family_name,
            p.position as position
          FROM prospects p
          WHERE p.status != 'Converted' AND p.status != 'Archived'
        `;
        const prospectResults = await c.env.DB.prepare(prospectQuery).all();
        contacts.push(...(prospectResults.results || []));
      }

      // Calculate ages
      const contactsWithAge = contacts.map((c: any) => ({
        ...c,
        age: calculateAge(c.birth_date)
      }));

      return c.json(contactsWithAge);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      return c.json({ error: "Failed to fetch contacts" }, 500);
    }
  });

  // Send email to selected contacts
  app.post("/api/portal/contacts/send-email", authMiddleware, async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const body = await c.req.json();
      const { emails, subject, content } = body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return c.json({ error: "No recipients provided" }, 400);
      }

      if (!subject || !content) {
        return c.json({ error: "Subject and content are required" }, 400);
      }

      const uniqueEmails = [...new Set(emails.filter(Boolean))];
      const formattedContent = content.replace(/\n/g, '<br>');

      let successCount = 0;
      let errorCount = 0;

      for (const email of uniqueEmails) {
        try {
          const result = await c.env.EMAILS.send({
            to: email,
            subject: subject,
            html_body: emailTemplate(`
              ${emailHeader(subject)}
              ${emailBody(`
                <div style="font-size: 16px; line-height: 24px; color: #3f3f46;">
                  ${formattedContent}
                </div>
              `)}
              ${emailFooter()}
            `),
            text_body: content,
            broadcast: true,
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Failed to send email to ${email}:`, err);
          errorCount++;
        }
      }

      return c.json({
        success: true,
        sent_count: successCount,
        error_count: errorCount,
      });
    } catch (error: any) {
      console.error("Error sending emails:", error);
      return c.json({ error: error.message || "Failed to send emails" }, 500);
    }
  });
}
