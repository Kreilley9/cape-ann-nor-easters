import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { requireAdmin } from "../middleware/roles.ts";
import { sendEmail } from "../lib/email.ts";

export const paymentEmailsRouter = Router();

const emailTemplate = (content: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;">${content}</div></body></html>`;

const emailHeader = (title: string) => `<div style="padding:32px 40px 24px;border-bottom:1px solid #e4e4e7;">
<h1 style="margin:0;font-size:24px;font-weight:600;color:#18181b;">${title}</h1></div>`;

const emailFooter = () => `<div style="padding:24px 40px;border-top:1px solid #e4e4e7;background:#f9fafb;">
<p style="margin:0;font-size:12px;color:#71717a;text-align:center;">Cape Ann Nor'easters Youth Flag Football Club<br>
<a href="https://capeannnoreasters.com" style="color:#00c4ff;">capeannnoreasters.com</a></p></div>`;

paymentEmailsRouter.get("/outstanding-dues/email-preview", requireAuth, requireAdmin, async (req, res) => {
  const { team_id, family_id } = req.query as Record<string, string>;
  let where = "WHERE pp.status = 'pending'";
  const params: unknown[] = [];
  let idx = 1;
  if (team_id) { where += ` AND tp.team_id = $${idx++}`; params.push(parseInt(team_id)); }
  if (family_id) { where += ` AND p.family_id = $${idx++}`; params.push(parseInt(family_id)); }
  const result = await pool.query(`
    SELECT f.id as family_id, f.name as family_name,
           COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email,
           SUM(pp.amount) as total_outstanding, COUNT(DISTINCT pp.id) as dues_count,
           STRING_AGG(DISTINCT p.first_name || ' ' || p.last_name, ', ') as player_names
    FROM player_payments pp
    JOIN players p ON pp.player_id = p.id
    LEFT JOIN families f ON p.family_id = f.id
    LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
    ${where}
    GROUP BY f.id, f.name, p.parent_1_email, p.parent_2_email, f.email
    HAVING COALESCE(p.parent_1_email, p.parent_2_email, f.email) IS NOT NULL
    ORDER BY f.name
  `, params);
  res.json(result.rows);
});

paymentEmailsRouter.post("/outstanding-dues/send-reminders", requireAuth, requireAdmin, async (req, res) => {
  const { family_ids, team_id, custom_message, include_details } = req.body;
  let where = "WHERE pp.status = 'pending'";
  const params: unknown[] = [];
  let idx = 1;
  if (family_ids?.length) {
    const phs = family_ids.map(() => `$${idx++}`).join(",");
    where += ` AND p.family_id IN (${phs})`; params.push(...family_ids);
  }
  if (team_id) { where += ` AND tp.team_id = $${idx++}`; params.push(parseInt(team_id)); }
  const dues = await pool.query(`
    SELECT pp.id, pp.amount, pay.description, pay.due_date, p.id as player_id,
           p.first_name, p.last_name, p.family_id, f.name as family_name,
           COALESCE(p.parent_1_email, p.parent_2_email, f.email) as email, t.name as team_name
    FROM player_payments pp JOIN payments pay ON pp.payment_id = pay.id
    JOIN players p ON pp.player_id = p.id LEFT JOIN families f ON p.family_id = f.id
    LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
    LEFT JOIN teams t ON tp.team_id = t.id
    ${where} ORDER BY f.name, p.last_name, p.first_name
  `, params);
  if (!dues.rows.length) { res.status(400).json({ error: "No outstanding dues found" }); return; }
  type RecipientDue = { player: string; description: string; amount: number; due_date: string | null };
  const byEmail: Record<string, { family_name: string; email: string; total: number; dues: RecipientDue[] }> = {};
  for (const due of dues.rows) {
    if (!due.email) continue;
    if (!byEmail[due.email]) byEmail[due.email] = { family_name: due.family_name || "Family", email: due.email, total: 0, dues: [] };
    byEmail[due.email].total += Number(due.amount);
    byEmail[due.email].dues.push({ player: `${due.first_name} ${due.last_name}`, description: due.description, amount: Number(due.amount), due_date: due.due_date });
  }
  const emailList = Object.values(byEmail);
  if (!emailList.length) { res.status(400).json({ error: "No valid email addresses found" }); return; }
  let successCount = 0, errorCount = 0;
  for (const recipient of emailList) {
    let duesTable = "";
    if (include_details !== false) {
      duesTable = `<table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead><tr style="border-bottom:2px solid #e4e4e7;">
          <th style="padding:8px;text-align:left;color:#71717a;font-size:12px;">Player</th>
          <th style="padding:8px;text-align:left;color:#71717a;font-size:12px;">Description</th>
          <th style="padding:8px;text-align:left;color:#71717a;font-size:12px;">Due Date</th>
          <th style="padding:8px;text-align:right;color:#71717a;font-size:12px;">Amount</th>
        </tr></thead><tbody>
        ${recipient.dues.map(d => `<tr style="border-bottom:1px solid #e4e4e7;">
          <td style="padding:8px;color:#3f3f46;">${d.player}</td>
          <td style="padding:8px;color:#3f3f46;">${d.description}</td>
          <td style="padding:8px;color:#71717a;">${d.due_date ? new Date(d.due_date).toLocaleDateString() : "-"}</td>
          <td style="padding:8px;text-align:right;color:#3f3f46;">$${d.amount.toFixed(2)}</td>
        </tr>`).join("")}
        <tr style="background:#f9fafb;"><td colspan="3" style="padding:12px 8px;font-weight:600;color:#18181b;">Total Outstanding</td>
          <td style="padding:12px 8px;text-align:right;font-weight:600;color:#f97316;font-size:18px;">$${recipient.total.toFixed(2)}</td>
        </tr></tbody></table>`;
    }
    const customContent = custom_message ? `<p style="margin:0 0 20px;font-size:16px;line-height:24px;color:#3f3f46;">${custom_message.replace(/\n/g, "<br>")}</p>` : "";
    const body = `<div style="padding:32px 40px;">
      <p style="margin:0 0 16px;font-size:16px;color:#3f3f46;">Dear ${recipient.family_name},</p>
      ${customContent}
      <p style="margin:0 0 16px;font-size:16px;color:#3f3f46;">This is a friendly reminder that you have outstanding dues totaling <strong style="color:#f97316;">$${recipient.total.toFixed(2)}</strong>.</p>
      ${duesTable}
      <p style="margin:20px 0 0;font-size:16px;color:#3f3f46;">Thank you for being part of the Nor'easters family!</p></div>`;
    const { error } = await sendEmail({
      to: recipient.email,
      subject: `Payment Reminder - $${recipient.total.toFixed(2)} Outstanding`,
      html: emailTemplate(`${emailHeader("Payment Reminder")}${body}${emailFooter()}`),
    });
    if (error) { errorCount++; console.error(`Failed to send to ${recipient.email}:`, error); } else { successCount++; }
  }
  res.json({ success: true, sent_count: successCount, error_count: errorCount, total_recipients: emailList.length });
});

paymentEmailsRouter.post("/accounting/send-report", requireAuth, requireAdmin, async (req, res) => {
  const { email, team_id, family_id } = req.body;
  if (!email) { res.status(400).json({ error: "Email address is required" }); return; }
  let where = "WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;
  if (team_id) { where += ` AND tp.team_id = $${idx++}`; params.push(parseInt(team_id)); }
  if (family_id) { where += ` AND p.family_id = $${idx++}`; params.push(parseInt(family_id)); }
  const result = await pool.query(`
    SELECT pp.amount, pp.status, pay.description, p.first_name || ' ' || p.last_name as player_name,
           f.name as family_name, t.name as team_name
    FROM player_payments pp JOIN payments pay ON pp.payment_id = pay.id
    JOIN players p ON pp.player_id = p.id LEFT JOIN families f ON p.family_id = f.id
    LEFT JOIN team_players tp ON p.id = tp.player_id AND tp.is_active = TRUE
    LEFT JOIN teams t ON tp.team_id = t.id ${where} ORDER BY pp.status, f.name
  `, params);
  const payments = result.rows;
  const totalDues = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
  const totalWaived = payments.filter(p => p.status === "waived").reduce((s, p) => s + Number(p.amount), 0);
  const totalOutstanding = payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);
  const reportDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const body = `<div style="padding:32px 40px;">
    <p style="margin:0 0 20px;font-size:14px;color:#71717a;">Report generated on ${reportDate}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background:#f9fafb;border-radius:8px 0 0 8px;"><p style="margin:0;font-size:12px;color:#71717a;">Total Dues</p><p style="margin:4px 0 0;font-size:24px;font-weight:600;color:#18181b;">$${totalDues.toFixed(2)}</p></td>
        <td style="padding:16px;background:#f0fdf4;"><p style="margin:0;font-size:12px;color:#71717a;">Collected</p><p style="margin:4px 0 0;font-size:24px;font-weight:600;color:#22c55e;">$${totalPaid.toFixed(2)}</p></td>
        <td style="padding:16px;background:#faf5ff;"><p style="margin:0;font-size:12px;color:#71717a;">Waived</p><p style="margin:4px 0 0;font-size:24px;font-weight:600;color:#a855f7;">$${totalWaived.toFixed(2)}</p></td>
        <td style="padding:16px;background:#fff7ed;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:12px;color:#71717a;">Outstanding</p><p style="margin:4px 0 0;font-size:24px;font-weight:600;color:#f97316;">$${totalOutstanding.toFixed(2)}</p></td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#71717a;">Collection Rate: <strong style="color:#18181b;">${totalDues > 0 ? ((totalPaid / totalDues) * 100).toFixed(1) : 0}%</strong></p>
  </div>`;
  const { error } = await sendEmail({ to: email, subject: `Accounting Report - ${reportDate}`, html: emailTemplate(`${emailHeader("Accounting Report")}${body}${emailFooter()}`) });
  if (error) { res.status(500).json({ error }); return; }
  res.json({ success: true });
});
