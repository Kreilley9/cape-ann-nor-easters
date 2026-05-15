import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import { authRouter } from "./routes/auth.ts";
import { boardsRouter } from "./routes/boards.ts";
import { reservationsRouter } from "./routes/reservations.ts";
import { playersRouter } from "./routes/players.ts";
import { teamsRouter } from "./routes/teams.ts";
import { seasonsRouter } from "./routes/seasons.ts";
import { eventsRouter } from "./routes/events.ts";
import { paymentsRouter } from "./routes/payments.ts";
import { uniformsRouter } from "./routes/uniforms.ts";
import { familiesRouter } from "./routes/families.ts";
import { prospectsRouter } from "./routes/prospects.ts";
import { surveysRouter } from "./routes/surveys.ts";
import { adminRouter } from "./routes/admin.ts";
import { configRouter } from "./routes/config.ts";
import { rolesRouter } from "./routes/roles.ts";
import { invitesRouter } from "./routes/invites.ts";
import { activityRouter } from "./routes/activity.ts";
import { coachesRouter } from "./routes/coaches.ts";
import { coachesPublicRouter } from "./routes/coaches-public.ts";
import { contactRouter } from "./routes/contact.ts";
import { contactsRouter } from "./routes/contacts.ts";
import { galleryRouter } from "./routes/gallery.ts";
import { groupMessagesRouter } from "./routes/group-messages.ts";
import { newsRouter } from "./routes/news.ts";
import { notificationPreferencesRouter } from "./routes/notification-preferences.ts";
import { paymentEmailsRouter } from "./routes/payment-emails.ts";
import { rafflesRouter } from "./routes/raffles.ts";
import { teamMessagesRouter } from "./routes/team-messages.ts";
import { teamsPublicRouter } from "./routes/teams-public.ts";
import { calendarRouter } from "./routes/calendar.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);
app.use("/api/invites/validate", authLimiter);
app.use("/api/oauth", authLimiter);

// Public + mixed routes
app.use("/api", authRouter);
app.use("/api", boardsRouter);
app.use("/api", reservationsRouter);
// configRouter has both public routes (/tryout-config etc.) and portal routes (/portal/...)
// mounting at /api gives /api/portal/tryout-config for the portal endpoints
app.use("/api", configRouter);
app.use("/api", galleryRouter);       // routes start with /gallery
app.use("/api", newsRouter);          // routes start with /news-posts and /news-images
app.use("/api", coachesPublicRouter); // routes start with /coaches
app.use("/api", teamsPublicRouter);   // routes start with /teams-public
app.use("/api", contactRouter);       // routes start with /contact and /sponsorship
app.use("/api", rafflesRouter);       // has both /raffles-public (no auth) and /raffles (admin)
// calendar: auth routes used by portal, public ICS feed by calendar apps
app.use("/api/portal", calendarRouter);
app.use("/api/public", calendarRouter); // public /calendar/:token.ics feed

// Authenticated portal routes
app.use("/api/portal", playersRouter);
app.use("/api/portal", teamsRouter);
app.use("/api/portal", seasonsRouter);
app.use("/api/portal", eventsRouter);
app.use("/api/portal", paymentsRouter);
app.use("/api/portal", uniformsRouter);
app.use("/api/portal", familiesRouter);
app.use("/api/portal", prospectsRouter);
app.use("/api/portal", surveysRouter);
app.use("/api/portal", adminRouter);
app.use("/api/portal", rolesRouter);
app.use("/api/portal", invitesRouter);
app.use("/api/portal", activityRouter);
app.use("/api/portal", coachesRouter);
app.use("/api/portal", contactsRouter);
app.use("/api/portal", groupMessagesRouter);
app.use("/api/portal", notificationPreferencesRouter);
app.use("/api/portal", paymentEmailsRouter);
app.use("/api/portal", teamMessagesRouter);

// Serve React app in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global error handler — must be last middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
