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
  <img src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Nor'easters-Snow-Logo-No-Background.png" alt="Cape Ann Nor'easters" style="width: 60px; height: 60px; margin-bottom: 16px;">
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

export function setupGroupMessageEndpoints(
  app: Hono<{ Bindings: Env }>,
  authMiddleware: any,
  requireAdmin: any
) {
  // Get recipients based on filters
  app.get("/api/portal/group-message-recipients", authMiddleware, requireAdmin, async (c) => {
    const type = c.req.query("type") || "all";
    const teamIds = c.req.query("team_ids");
    const status = c.req.query("status");
    
    try {
      let query = "";
      const params: any[] = [];
      
      if (type === "all") {
        // Get all players with parent emails
        query = `
          SELECT DISTINCT 
            p.id,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name,
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.status,
            NULL as team_name
          FROM players p
          LEFT JOIN families f ON p.family_id = f.id
          WHERE COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
      } else if (type === "teams" && teamIds) {
        const ids = teamIds.split(",").map(id => parseInt(id)).filter(id => !isNaN(id));
        if (ids.length === 0) {
          return c.json([]);
        }
        const placeholders = ids.map(() => "?").join(",");
        query = `
          SELECT DISTINCT 
            p.id,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name,
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.status,
            t.name as team_name
          FROM players p
          JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
          JOIN teams t ON tp.team_id = t.id
          LEFT JOIN families f ON p.family_id = f.id
          WHERE tp.team_id IN (${placeholders})
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
        params.push(...ids);
      } else if (type === "status" && status) {
        query = `
          SELECT DISTINCT 
            p.id,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name,
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.status,
            NULL as team_name
          FROM players p
          LEFT JOIN families f ON p.family_id = f.id
          WHERE p.status = ?
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
        params.push(status);
      } else {
        return c.json([]);
      }
      
      const recipients = await c.env.DB.prepare(query).bind(...params).all();
      return c.json(recipients.results);
    } catch (error) {
      console.error("Error fetching recipients:", error);
      return c.json({ error: "Failed to fetch recipients" }, 500);
    }
  });

  // Get sent message history
  app.get("/api/portal/group-messages", authMiddleware, requireAdmin, async (c) => {
    try {
      const messages = await c.env.DB.prepare(`
        SELECT id, subject, recipient_type, recipient_count, sent_at, sent_by_name
        FROM group_messages
        ORDER BY sent_at DESC
        LIMIT 20
      `).all();
      return c.json(messages.results);
    } catch (error) {
      console.error("Error fetching group messages:", error);
      return c.json({ error: "Failed to fetch messages" }, 500);
    }
  });

  // Send group message
  app.post("/api/portal/group-messages", authMiddleware, requireAdmin, async (c) => {
    const user = c.get("user");
    
    try {
      const body = await c.req.json();
      const { subject, content, recipient_type, team_ids, player_status } = body;
      
      if (!subject || !content) {
        return c.json({ error: "Subject and content are required" }, 400);
      }
      
      // Build recipient query based on type
      let query = "";
      const params: any[] = [];
      
      if (recipient_type === "all") {
        query = `
          SELECT DISTINCT 
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name
          FROM players p
          LEFT JOIN families f ON p.family_id = f.id
          WHERE COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
      } else if (recipient_type === "teams" && team_ids?.length > 0) {
        const placeholders = team_ids.map(() => "?").join(",");
        query = `
          SELECT DISTINCT 
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name
          FROM players p
          JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
          LEFT JOIN families f ON p.family_id = f.id
          WHERE tp.team_id IN (${placeholders})
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
        params.push(...team_ids);
      } else if (recipient_type === "status" && player_status) {
        query = `
          SELECT DISTINCT 
            COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
            p.first_name || ' ' || p.last_name as player_name,
            f.name as family_name
          FROM players p
          LEFT JOIN families f ON p.family_id = f.id
          WHERE p.status = ?
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
            AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        `;
        params.push(player_status);
      } else {
        return c.json({ error: "Invalid recipient selection" }, 400);
      }
      
      const recipientsResult = await c.env.DB.prepare(query).bind(...params).all();
      const recipients = recipientsResult.results as { email: string; player_name: string; family_name: string }[];
      
      if (recipients.length === 0) {
        return c.json({ error: "No recipients found" }, 400);
      }
      
      // Get unique emails
      const uniqueEmails = [...new Set(recipients.map(r => r.email).filter(Boolean))];
      
      // Create message record
      const now = new Date().toISOString();
      const messageResult = await c.env.DB.prepare(`
        INSERT INTO group_messages (subject, content, recipient_type, team_ids, player_status, recipient_count, sent_at, sent_by_user_id, sent_by_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        subject,
        content,
        recipient_type,
        team_ids ? JSON.stringify(team_ids) : null,
        player_status || null,
        uniqueEmails.length,
        now,
        user?.id || "unknown",
        user?.google_user_data?.name || user?.email || "Unknown",
        now,
        now
      ).run();
      
      const messageId = messageResult.meta.last_row_id;
      
      // Format message content for email (convert newlines to <br>)
      const formattedContent = content.replace(/\n/g, '<br>');
      
      // Send emails
      let successCount = 0;
      let errorCount = 0;
      
      for (const email of uniqueEmails) {
        try {
          // Record recipient
          await c.env.DB.prepare(`
            INSERT INTO group_message_recipients (message_id, email, status, created_at, updated_at)
            VALUES (?, ?, 'pending', ?, ?)
          `).bind(messageId, email, now, now).run();
          
          // Send email
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
            await c.env.DB.prepare(`
              UPDATE group_message_recipients SET status = 'sent', sent_at = ? WHERE message_id = ? AND email = ?
            `).bind(now, messageId, email).run();
            successCount++;
          } else {
            await c.env.DB.prepare(`
              UPDATE group_message_recipients SET status = 'failed', error = ? WHERE message_id = ? AND email = ?
            `).bind(result.error || "Unknown error", messageId, email).run();
            errorCount++;
          }
        } catch (err: any) {
          console.error(`Failed to send email to ${email}:`, err);
          await c.env.DB.prepare(`
            UPDATE group_message_recipients SET status = 'failed', error = ? WHERE message_id = ? AND email = ?
          `).bind(err.message || "Unknown error", messageId, email).run();
          errorCount++;
        }
      }
      
      return c.json({
        success: true,
        message_id: messageId,
        recipient_count: uniqueEmails.length,
        sent_count: successCount,
        error_count: errorCount,
      });
    } catch (error: any) {
      console.error("Error sending group message:", error);
      return c.json({ error: error.message || "Failed to send message" }, 500);
    }
  });
}
