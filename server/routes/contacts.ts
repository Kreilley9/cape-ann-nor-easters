import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin } from "../middleware/roles.ts";
import { sendEmail } from "../lib/email.ts";

export const contactsRouter = Router();

const LOGO_URL = "https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png";

function buildEmailHtml(subject: string, content: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:40px 20px;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;">
    <div style="padding:32px 40px 24px 40px;border-bottom:1px solid #e4e4e7;">
      <img src="${LOGO_URL}" alt="" style="width:60px;height:60px;margin-bottom:16px;">
      <h1 style="margin:0;font-size:24px;font-weight:600;color:#18181b;">${subject}</h1>
    </div>
    <div style="padding:32px 40px;">
      <div style="font-size:16px;line-height:24px;color:#3f3f46;">${content.replace(/\n/g, "<br>")}</div>
    </div>
    <div style="padding:24px 40px;border-top:1px solid #e4e4e7;background-color:#f9fafb;">
      <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">
        Cape Ann Nor'easters Youth Flag Football Club<br>
        <a href="https://capeannnoreasters.com" style="color:#00c4ff;">capeannnoreasters.com</a>
      </p>
    </div>
  </div>
</body></html>`;
}

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

contactsRouter.get("/contacts", requireAuth, async (req, res) => {
  const user = req.user!;
  const adminCheck = await isAdmin(user.id, user.email!);

  const coachTeams = await pool.query(
    "SELECT team_id FROM user_roles WHERE user_id = $1 AND LOWER(role) = 'coach' AND team_id IS NOT NULL",
    [user.id]
  );
  const coachTeamIds = coachTeams.rows.map((r: { team_id: number }) => r.team_id);

  if (!adminCheck && coachTeamIds.length === 0) {
    res.json([]);
    return;
  }

  const contacts: Record<string, unknown>[] = [];

  let coachQuery = `
    SELECT DISTINCT 'coach-' || ur.id as id, ur.name, ur.email, NULL as phone,
      'coach' as role, NULL as status, NULL as birth_date,
      ur.team_id, t.name as team_name, NULL as family_id, NULL as family_name, NULL as position
    FROM user_roles ur LEFT JOIN teams t ON ur.team_id = t.id
    WHERE LOWER(ur.role) = 'coach'`;
  if (!adminCheck) {
    const ph = coachTeamIds.map((_: number, i: number) => `$${i + 1}`).join(",");
    coachQuery += ` AND ur.team_id IN (${ph})`;
    const r = await pool.query(coachQuery, coachTeamIds);
    contacts.push(...r.rows);
  } else {
    const r = await pool.query(coachQuery);
    contacts.push(...r.rows);
  }

  let playerQuery = `
    SELECT DISTINCT 'player-' || p.id as id,
      CONCAT(p.first_name, ' ', p.last_name) as name,
      COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
      COALESCE(p.parent_1_phone, p.parent_2_phone) as phone,
      'player' as role, p.status, p.birth_date,
      tp.team_id, t.name as team_name, p.family_id, f.name as family_name, NULL as position
    FROM players p LEFT JOIN families f ON p.family_id = f.id
    LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
    LEFT JOIN teams t ON tp.team_id = t.id`;
  if (!adminCheck) {
    const ph = coachTeamIds.map((_: number, i: number) => `$${i + 1}`).join(",");
    playerQuery += ` WHERE tp.team_id IN (${ph})`;
    const r = await pool.query(playerQuery, coachTeamIds);
    contacts.push(...r.rows);
  } else {
    const r = await pool.query(playerQuery);
    contacts.push(...r.rows);
  }

  let hasRecruiting = adminCheck;
  if (!adminCheck) {
    const perm = await pool.query(
      "SELECT permission_value FROM user_permissions WHERE user_id = $1 AND permission_key = 'recruiting_access'",
      [user.id]
    );
    hasRecruiting = perm.rows[0]?.permission_value === "1";
  }
  if (hasRecruiting) {
    const r = await pool.query(`
      SELECT DISTINCT 'prospect-' || p.id as id,
        CONCAT(p.first_name, ' ', p.last_name) as name,
        COALESCE(p.parent_email, p.email) as email,
        COALESCE(p.parent_phone, p.phone) as phone,
        'prospect' as role, p.interest_level as status, p.birth_date,
        NULL as team_id, NULL as team_name, NULL as family_id, NULL as family_name, p.position
      FROM prospects p WHERE p.status != 'Converted' AND p.status != 'Archived'`);
    contacts.push(...r.rows);
  }

  res.json(contacts.map((c) => ({ ...c, age: calcAge(c.birth_date as string | null) })));
});

contactsRouter.post("/contacts/send-email", requireAuth, async (req, res) => {
  const { emails, subject, content } = req.body;
  if (!emails?.length || !subject || !content) {
    res.status(400).json({ error: "emails, subject, and content are required" });
    return;
  }
  const unique = [...new Set((emails as string[]).filter(Boolean))];
  let successCount = 0;
  let errorCount = 0;
  for (const email of unique) {
    const result = await sendEmail({ to: email, subject, html: buildEmailHtml(subject, content) });
    if (result.success) successCount++;
    else errorCount++;
  }
  res.json({ success: true, sent_count: successCount, error_count: errorCount });
});
