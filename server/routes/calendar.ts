import { Router, Request, Response } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";

export const calendarRouter = Router();

function generateICSContent(events: Record<string, unknown>[], calendarName = "Team Schedule") {
  const formatICSDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}${mo}${day}T${h}${min}${s}`;
  };

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Youth Sports Portal//Schedule Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarName}`,
    "X-WR-TIMEZONE:America/New_York",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const event of events) {
    const startDate = formatICSDate(event.start_at as string);
    const endDate = event.end_at ? formatICSDate(event.end_at as string) : startDate;
    let description = (event.description as string) || "";
    if (event.team_name) description = `Team: ${event.team_name}${description ? "\n" + description : ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:event-${event.id}@youth-sports-portal.com`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      `DTSTART;TZID=America/New_York:${startDate}`,
      `DTEND;TZID=America/New_York:${endDate}`,
      `SUMMARY:${(event.title as string).replace(/[,;]/g, "\\$&")}`,
    );
    if (description) lines.push(`DESCRIPTION:${description.replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n")}`);
    if (event.location) lines.push(`LOCATION:${(event.location as string).replace(/[,;]/g, "\\$&")}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function getEvents(teamIdsStr?: string | null) {
  const result = await pool.query(`
    SELECT e.id, e.team_id, e.event_type, e.title, e.description, e.location,
           e.start_at, e.end_at, e.is_cancelled, t.name as team_name
    FROM events e LEFT JOIN teams t ON e.team_id = t.id
    WHERE e.is_cancelled = FALSE ORDER BY e.start_at ASC
  `);
  let events = result.rows;
  if (teamIdsStr && teamIdsStr !== "null") {
    const selectedIds = teamIdsStr.split(",").map(id => parseInt(id));
    events = events.filter(e => e.team_id === null || selectedIds.includes(e.team_id));
  }
  return events;
}

calendarRouter.get("/events/export/icalendar", requireAuth, async (req, res) => {
  const events = await getEvents(req.query.team_ids as string | undefined);
  const ics = generateICSContent(events);
  res.set({ "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="team-schedule.ics"' });
  res.send(ics);
});

calendarRouter.post("/calendar-subscription", requireAuth, async (req, res) => {
  const { team_ids, name } = req.body;
  const teamIds = team_ids && team_ids !== "null" ? team_ids : null;
  const calName = name || "My Team Calendar";
  const existing = await pool.query("SELECT * FROM calendar_subscriptions WHERE user_id = $1", [req.user!.id]);
  if (existing.rows.length > 0) {
    await pool.query(`UPDATE calendar_subscriptions SET team_ids=$1, name=$2, updated_at=NOW() WHERE user_id=$3`, [teamIds, calName, req.user!.id]);
    res.json({ token: existing.rows[0].token, subscription_url: `/api/public/calendar/${existing.rows[0].token}.ics` }); return;
  }
  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO calendar_subscriptions (user_id, token, name, team_ids, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW())`,
    [req.user!.id, token, calName, teamIds]
  );
  res.status(201).json({ token, subscription_url: `/api/public/calendar/${token}.ics` });
});

calendarRouter.get("/calendar-subscription", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT token, name, team_ids, is_active FROM calendar_subscriptions WHERE user_id = $1",
    [req.user!.id]
  );
  if (result.rows[0]) {
    res.json({ ...result.rows[0], subscription_url: `/api/public/calendar/${result.rows[0].token}.ics` }); return;
  }
  res.json({ subscription: null });
});

calendarRouter.delete("/calendar-subscription", requireAuth, async (req, res) => {
  await pool.query("DELETE FROM calendar_subscriptions WHERE user_id = $1", [req.user!.id]);
  res.json({ success: true });
});

// Public ICS feed — no auth, token-based
calendarRouter.get("/calendar/:token", async (req: Request, res: Response) => {
  let token = req.params.token as string;
  if (token.endsWith(".ics")) token = token.slice(0, -4);
  const sub = await pool.query("SELECT * FROM calendar_subscriptions WHERE token=$1 AND is_active=TRUE", [token]);
  if (!sub.rows[0]) { res.status(404).send("Calendar not found"); return; }
  const events = await getEvents(sub.rows[0].team_ids);
  const calName = sub.rows[0].name || "Team Schedule";
  const ics = generateICSContent(events, calName);
  res.set({ "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache, must-revalidate" });
  res.send(ics);
});
