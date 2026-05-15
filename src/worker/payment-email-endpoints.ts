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

export function setupPaymentEmailEndpoints(
  app: Hono<{ Bindings: Env }>,
  authMiddleware: any,
  requireAdmin: any
) {
  // Get families with outstanding dues (for preview)
  app.get("/api/portal/outstanding-dues/email-preview", authMiddleware, requireAdmin, async (c) => {
    const teamId = c.req.query("team_id");
    const familyId = c.req.query("family_id");
    
    try {
      let whereClause = "WHERE pp.status = 'pending'";
      const params: any[] = [];
      
      if (teamId) {
        whereClause += " AND tp.team_id = ?";
        params.push(parseInt(teamId));
      }
      if (familyId) {
        whereClause += " AND p.family_id = ?";
        params.push(parseInt(familyId));
      }
      
      // Get outstanding dues grouped by family with email addresses
      const query = `
        SELECT 
          f.id as family_id,
          f.name as family_name,
          COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
          SUM(pp.amount) as total_outstanding,
          COUNT(DISTINCT pp.id) as dues_count,
          GROUP_CONCAT(DISTINCT p.first_name || ' ' || p.last_name) as player_names
        FROM player_payments pp
        JOIN players p ON pp.player_id = p.id
        LEFT JOIN families f ON p.family_id = f.id
        LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
        ${whereClause}
        GROUP BY f.id
        HAVING COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
          AND COALESCE(p.parent_1_email, p.parent_2_email, f.email) != ''
        ORDER BY f.name
      `;
      
      const result = await c.env.DB.prepare(query).bind(...params).all();
      return c.json(result.results);
    } catch (error) {
      console.error("Error fetching email preview:", error);
      return c.json({ error: "Failed to fetch preview" }, 500);
    }
  });

  // Send payment reminder emails
  app.post("/api/portal/outstanding-dues/send-reminders", authMiddleware, requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const { family_ids, team_id, custom_message, include_details } = body;
      
      // Build query to get outstanding dues
      let whereClause = "WHERE pp.status = 'pending'";
      const params: any[] = [];
      
      if (family_ids && family_ids.length > 0) {
        const placeholders = family_ids.map(() => "?").join(",");
        whereClause += ` AND p.family_id IN (${placeholders})`;
        params.push(...family_ids);
      }
      if (team_id) {
        whereClause += " AND tp.team_id = ?";
        params.push(parseInt(team_id));
      }
      
      // Get all outstanding dues with details
      const duesQuery = `
        SELECT 
          pp.id,
          pp.amount,
          pay.description,
          pay.due_date,
          p.id as player_id,
          p.first_name,
          p.last_name,
          p.family_id,
          f.name as family_name,
          COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
          t.name as team_name
        FROM player_payments pp
        JOIN payments pay ON pp.payment_id = pay.id
        JOIN players p ON pp.player_id = p.id
        LEFT JOIN families f ON p.family_id = f.id
        LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
        LEFT JOIN teams t ON tp.team_id = t.id
        ${whereClause}
        ORDER BY f.name, p.last_name, p.first_name
      `;
      
      const duesResult = await c.env.DB.prepare(duesQuery).bind(...params).all();
      const dues = duesResult.results as any[];
      
      if (dues.length === 0) {
        return c.json({ error: "No outstanding dues found" }, 400);
      }
      
      // Group dues by family email
      const byEmail: Record<string, {
        family_name: string;
        email: string;
        total: number;
        dues: { player: string; description: string; amount: number; due_date: string | null }[];
      }> = {};
      
      for (const due of dues) {
        if (!due.email) continue;
        
        if (!byEmail[due.email]) {
          byEmail[due.email] = {
            family_name: due.family_name || "Family",
            email: due.email,
            total: 0,
            dues: [],
          };
        }
        byEmail[due.email].total += due.amount;
        byEmail[due.email].dues.push({
          player: `${due.first_name} ${due.last_name}`,
          description: due.description,
          amount: due.amount,
          due_date: due.due_date,
        });
      }
      
      const emailList = Object.values(byEmail);
      if (emailList.length === 0) {
        return c.json({ error: "No valid email addresses found" }, 400);
      }
      
      // Send emails
      let successCount = 0;
      let errorCount = 0;
      
      for (const recipient of emailList) {
        try {
          // Build dues table for email
          let duesTable = "";
          if (include_details !== false) {
            duesTable = `
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="border-bottom: 2px solid #e4e4e7;">
                    <th style="padding: 8px; text-align: left; color: #71717a; font-size: 12px;">Player</th>
                    <th style="padding: 8px; text-align: left; color: #71717a; font-size: 12px;">Description</th>
                    <th style="padding: 8px; text-align: left; color: #71717a; font-size: 12px;">Due Date</th>
                    <th style="padding: 8px; text-align: right; color: #71717a; font-size: 12px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${recipient.dues.map(d => `
                    <tr style="border-bottom: 1px solid #e4e4e7;">
                      <td style="padding: 8px; color: #3f3f46;">${d.player}</td>
                      <td style="padding: 8px; color: #3f3f46;">${d.description}</td>
                      <td style="padding: 8px; color: #71717a;">${d.due_date ? new Date(d.due_date).toLocaleDateString() : '-'}</td>
                      <td style="padding: 8px; text-align: right; color: #3f3f46;">$${d.amount.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  <tr style="background-color: #f9fafb;">
                    <td colspan="3" style="padding: 12px 8px; font-weight: 600; color: #18181b;">Total Outstanding</td>
                    <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #f97316; font-size: 18px;">$${recipient.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            `;
          }
          
          const customContent = custom_message 
            ? `<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">${custom_message.replace(/\n/g, '<br>')}</p>`
            : '';
          
          const emailContent = `
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
              Dear ${recipient.family_name},
            </p>
            ${customContent}
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
              This is a friendly reminder that you have outstanding dues totaling <strong style="color: #f97316;">$${recipient.total.toFixed(2)}</strong>.
            </p>
            ${duesTable}
            <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
              If you have any questions or need to discuss payment arrangements, please don't hesitate to reach out.
            </p>
            <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 24px; color: #3f3f46;">
              Thank you for being part of the Nor'easters family!
            </p>
          `;
          
          const result = await c.env.EMAILS.send({
            to: recipient.email,
            subject: `Payment Reminder - $${recipient.total.toFixed(2)} Outstanding`,
            html_body: emailTemplate(`
              ${emailHeader("Payment Reminder")}
              ${emailBody(emailContent)}
              ${emailFooter()}
            `),
            text_body: `Dear ${recipient.family_name},\n\nThis is a friendly reminder that you have outstanding dues totaling $${recipient.total.toFixed(2)}.\n\n${recipient.dues.map(d => `- ${d.player}: ${d.description} - $${d.amount.toFixed(2)}`).join('\n')}\n\nIf you have any questions, please reach out.\n\nThank you,\nCape Ann Nor'easters`,
            broadcast: true,
          });
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            console.error(`Failed to send to ${recipient.email}:`, result.error);
          }
        } catch (err: any) {
          console.error(`Error sending to ${recipient.email}:`, err);
          errorCount++;
        }
      }
      
      return c.json({
        success: true,
        sent_count: successCount,
        error_count: errorCount,
        total_recipients: emailList.length,
      });
    } catch (error: any) {
      console.error("Error sending payment reminders:", error);
      return c.json({ error: error.message || "Failed to send reminders" }, 500);
    }
  });

  // Send accounting summary report via email
  app.post("/api/portal/accounting/send-report", authMiddleware, requireAdmin, async (c) => {
    try {
      const body = await c.req.json();
      const { email, team_id, family_id } = body;
      
      if (!email) {
        return c.json({ error: "Email address is required" }, 400);
      }
      
      // Build query
      let whereClause = "WHERE 1=1";
      const params: any[] = [];
      
      if (team_id) {
        whereClause += " AND tp.team_id = ?";
        params.push(parseInt(team_id));
      }
      if (family_id) {
        whereClause += " AND p.family_id = ?";
        params.push(parseInt(family_id));
      }
      
      // Get all payments
      const query = `
        SELECT 
          pp.amount,
          pp.status,
          pay.description,
          p.first_name || ' ' || p.last_name as player_name,
          f.name as family_name,
          t.name as team_name
        FROM player_payments pp
        JOIN payments pay ON pp.payment_id = pay.id
        JOIN players p ON pp.player_id = p.id
        LEFT JOIN families f ON p.family_id = f.id
        LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = 1
        LEFT JOIN teams t ON tp.team_id = t.id
        ${whereClause}
        ORDER BY pp.status, f.name
      `;
      
      const result = await c.env.DB.prepare(query).bind(...params).all();
      const payments = result.results as any[];
      
      // Calculate totals
      const totalDues = payments.reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
      const totalWaived = payments.filter(p => p.status === "waived").reduce((sum, p) => sum + p.amount, 0);
      const totalOutstanding = payments.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
      
      const reportDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const emailContent = `
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #71717a;">
          Report generated on ${reportDate}
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px; background-color: #f9fafb; border-radius: 8px 0 0 8px;">
              <p style="margin: 0; font-size: 12px; color: #71717a;">Total Dues</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 600; color: #18181b;">$${totalDues.toFixed(2)}</p>
            </td>
            <td style="padding: 16px; background-color: #f0fdf4;">
              <p style="margin: 0; font-size: 12px; color: #71717a;">Collected</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 600; color: #22c55e;">$${totalPaid.toFixed(2)}</p>
            </td>
            <td style="padding: 16px; background-color: #faf5ff;">
              <p style="margin: 0; font-size: 12px; color: #71717a;">Waived</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 600; color: #a855f7;">$${totalWaived.toFixed(2)}</p>
            </td>
            <td style="padding: 16px; background-color: #fff7ed; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; font-size: 12px; color: #71717a;">Outstanding</p>
              <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 600; color: #f97316;">$${totalOutstanding.toFixed(2)}</p>
            </td>
          </tr>
        </table>
        
        <p style="margin: 0; font-size: 14px; color: #71717a;">
          Collection Rate: <strong style="color: #18181b;">${totalDues > 0 ? ((totalPaid / totalDues) * 100).toFixed(1) : 0}%</strong>
        </p>
      `;
      
      const sendResult = await c.env.EMAILS.send({
        to: email,
        subject: `Accounting Report - ${reportDate}`,
        html_body: emailTemplate(`
          ${emailHeader("Accounting Report")}
          ${emailBody(emailContent)}
          ${emailFooter()}
        `),
        text_body: `Accounting Report - ${reportDate}\n\nTotal Dues: $${totalDues.toFixed(2)}\nCollected: $${totalPaid.toFixed(2)}\nWaived: $${totalWaived.toFixed(2)}\nOutstanding: $${totalOutstanding.toFixed(2)}\n\nCollection Rate: ${totalDues > 0 ? ((totalPaid / totalDues) * 100).toFixed(1) : 0}%`,
        broadcast: false,
      });
      
      if (sendResult.success) {
        return c.json({ success: true });
      } else {
        return c.json({ error: sendResult.error || "Failed to send email" }, 500);
      }
    } catch (error: any) {
      console.error("Error sending accounting report:", error);
      return c.json({ error: error.message || "Failed to send report" }, 500);
    }
  });
}
