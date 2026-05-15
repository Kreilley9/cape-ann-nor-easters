import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { sendEmail } from "../lib/email.ts";
import { getUserDisplayName } from "../lib/activity-logger.ts";

export const groupMessagesRouter = Router();

const LOGO_URL = "https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Noreasters%20Snow%20Logo%20No%20Background.png";

function buildGroupEmailHtml(subject: string, content: string) {
  const formattedContent = content.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:40px 20px;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;">
    <div style="padding:32px 40px 24px 40px;border-bottom:1px solid #e4e4e7;">
      <img src="${LOGO_URL}" alt="Cape Ann Nor'easters" style="width:60px;height:60px;margin-bottom:16px;">
      <h1 style="margin:0;font-size:24px;font-weight:600;color:#18181b;">${subject}</h1>
    </div>
    <div style="padding:32px 40px;">
      <div style="font-size:16px;line-height:24px;color:#3f3f46;">${formattedContent}</div>
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

groupMessagesRouter.get("/group-message-recipients", requireAuth, requireAdmin, async (req, res) => {
  const type = (req.query.type as string) || "all";
  const teamIds = req.query.team_ids as string | undefined;
  const status = req.query.status as string | undefined;

  let query = "";
  const params: (string | number)[] = [];

  if (type === "all") {
    query = `
      SELECT DISTINCT p.id,
        CONCAT(p.first_name, ' ', p.last_name) as player_name,
        f.name as family_name,
        COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
        p.status, NULL as team_name
      FROM players p LEFT JOIN families f ON p.family_id = f.id
      WHERE COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
  } else if (type === "teams" && teamIds) {
    const ids = teamIds.split(",").map(Number).filter(Boolean);
    if (ids.length === 0) { res.json([]); return; }
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    query = `
      SELECT DISTINCT p.id,
        CONCAT(p.first_name, ' ', p.last_name) as player_name,
        f.name as family_name,
        COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
        p.status, t.name as team_name
      FROM players p
      JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
      JOIN teams t ON tp.team_id = t.id
      LEFT JOIN families f ON p.family_id = f.id
      WHERE tp.team_id IN (${placeholders})
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
    params.push(...ids);
  } else if (type === "status" && status) {
    query = `
      SELECT DISTINCT p.id,
        CONCAT(p.first_name, ' ', p.last_name) as player_name,
        f.name as family_name,
        COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
        p.status, NULL as team_name
      FROM players p LEFT JOIN families f ON p.family_id = f.id
      WHERE p.status = $1
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
    params.push(status);
  } else {
    res.json([]);
    return;
  }

  const result = await pool.query(query, params);
  res.json(result.rows);
});

groupMessagesRouter.get("/group-messages", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `SELECT id, subject, recipient_type, recipient_count, sent_at, sent_by_name
     FROM group_messages ORDER BY sent_at DESC LIMIT 20`
  );
  res.json(result.rows);
});

groupMessagesRouter.post("/group-messages", requireAuth, requireAdmin, async (req, res) => {
  const { subject, content, recipient_type, team_ids, player_status } = req.body;
  if (!subject || !content) {
    res.status(400).json({ error: "Subject and content are required" });
    return;
  }

  let query = "";
  const params: (string | number)[] = [];

  if (recipient_type === "all") {
    query = `
      SELECT DISTINCT COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email
      FROM players p LEFT JOIN families f ON p.family_id = f.id
      WHERE COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
  } else if (recipient_type === "teams" && team_ids?.length > 0) {
    const placeholders = team_ids.map((_: unknown, i: number) => `$${i + 1}`).join(",");
    query = `
      SELECT DISTINCT COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email
      FROM players p
      JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
      LEFT JOIN families f ON p.family_id = f.id
      WHERE tp.team_id IN (${placeholders})
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
    params.push(...team_ids);
  } else if (recipient_type === "status" && player_status) {
    query = `
      SELECT DISTINCT COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email
      FROM players p LEFT JOIN families f ON p.family_id = f.id
      WHERE p.status = $1
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
        AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''`;
    params.push(player_status);
  } else {
    res.status(400).json({ error: "Invalid recipient selection" });
    return;
  }

  const recipientsResult = await pool.query(query, params);
  const uniqueEmails = [...new Set(recipientsResult.rows.map((r: { email: string }) => r.email).filter(Boolean))];

  if (uniqueEmails.length === 0) {
    res.status(400).json({ error: "No recipients found" });
    return;
  }

  const senderName = getUserDisplayName(req.user!);
  const msgResult = await pool.query(
    `INSERT INTO group_messages (subject, content, recipient_type, team_ids, player_status, recipient_count, sent_at, sent_by_user_id, sent_by_name, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,NOW(),NOW()) RETURNING id`,
    [
      subject, content, recipient_type,
      team_ids ? JSON.stringify(team_ids) : null,
      player_status || null,
      uniqueEmails.length,
      req.user!.id, senderName,
    ]
  );
  const messageId = msgResult.rows[0].id;

  let successCount = 0;
  let errorCount = 0;

  for (const email of uniqueEmails) {
    await pool.query(
      `INSERT INTO group_message_recipients (message_id, email, status, created_at, updated_at)
       VALUES ($1,$2,'pending',NOW(),NOW())`,
      [messageId, email]
    );

    const emailResult = await sendEmail({
      to: email as string,
      subject,
      html: buildGroupEmailHtml(subject, content),
    });

    if (emailResult.success) {
      await pool.query(
        `UPDATE group_message_recipients SET status='sent', sent_at=NOW() WHERE message_id=$1 AND email=$2`,
        [messageId, email]
      );
      successCount++;
    } else {
      await pool.query(
        `UPDATE group_message_recipients SET status='failed', error=$1 WHERE message_id=$2 AND email=$3`,
        [emailResult.error || "Unknown error", messageId, email]
      );
      errorCount++;
    }
  }

  res.json({ success: true, message_id: messageId, recipient_count: uniqueEmails.length, sent_count: successCount, error_count: errorCount });
});
