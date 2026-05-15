import { Router } from "express";
import multer from "multer";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles } from "../middleware/roles.ts";
import { uploadFile, getSignedUrl } from "../lib/storage.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";
import { sendEmail } from "../lib/email.ts";

export const coachesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  txt: "text/plain", csv: "text/csv",
};
function contentType(filename: string) {
  return CONTENT_TYPES[filename.toLowerCase().split(".").pop() || ""] || "application/octet-stream";
}

async function requireCoachOrAdmin(userId: string, userEmail: string | undefined): Promise<boolean> {
  const adminCheck = await isAdmin(userId, userEmail);
  if (adminCheck) return true;
  const roles = await getUserRoles(userId);
  return roles.some(r => r.role === "coach");
}

coachesRouter.post("/coaches/documents/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  const path = `${Date.now()}-${req.file.originalname}`;
  const fileKey = `coaches-documents/${path}`;
  await uploadFile("coach-documents", path, req.file.buffer, contentType(req.file.originalname));
  res.json({ file_key: fileKey });
});

coachesRouter.get("/coaches/documents/download/*", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const fileKey = req.path.replace("/coaches/documents/download/", "");
  try {
    const signedUrl = await getSignedUrl("coach-documents", fileKey.replace("coaches-documents/", ""));
    res.redirect(signedUrl);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

coachesRouter.get("/coaches/documents", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query("SELECT * FROM coaches_documents ORDER BY created_at DESC");
  res.json(result.rows);
});

coachesRouter.post("/coaches/documents", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, description, category, file_key, file_name, file_size } = req.body;
  if (!title || !file_key || !file_name) { res.status(400).json({ error: "title, file_key, file_name required" }); return; }
  const userName = getUserDisplayName(req.user!);
  const result = await pool.query(
    `INSERT INTO coaches_documents (title, description, category, file_key, file_name, file_size, uploaded_by_user_id, uploaded_by_name, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
    [title, description || null, category || null, file_key, file_name, file_size || null, req.user!.id, userName]
  );
  await logActivity({ userId: req.user!.id, userName, action: "created", entityType: "coaches_document", entityId: result.rows[0].id, entityName: title, details: `Uploaded ${file_name}` });
  res.json({ id: result.rows[0].id });
});

coachesRouter.delete("/coaches/documents/:id", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const doc = await pool.query("SELECT * FROM coaches_documents WHERE id=$1", [req.params.id]);
  await pool.query("DELETE FROM coaches_documents WHERE id=$1", [req.params.id]);
  if (doc.rows[0]) {
    await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "deleted", entityType: "coaches_document", entityId: Number(req.params.id), entityName: doc.rows[0].title, details: `Deleted ${doc.rows[0].file_name}` });
  }
  res.json({ success: true });
});

coachesRouter.get("/coaches/messages", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const result = await pool.query(`
    SELECT m.*, COUNT(r.id) as reply_count
    FROM coaches_messages m LEFT JOIN coaches_message_replies r ON m.id = r.message_id
    GROUP BY m.id ORDER BY m.is_pinned DESC, m.created_at DESC
  `);
  res.json(result.rows);
});

coachesRouter.get("/coaches/messages/:id", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const message = await pool.query("SELECT * FROM coaches_messages WHERE id=$1", [req.params.id]);
  if (!message.rows[0]) { res.status(404).json({ error: "Message not found" }); return; }
  const replies = await pool.query("SELECT * FROM coaches_message_replies WHERE message_id=$1 ORDER BY created_at ASC", [req.params.id]);
  res.json({ message: message.rows[0], replies: replies.rows });
});

coachesRouter.post("/coaches/messages", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { title, content } = req.body;
  if (!title || !content) { res.status(400).json({ error: "title and content required" }); return; }
  const userName = getUserDisplayName(req.user!);
  const result = await pool.query(
    `INSERT INTO coaches_messages (title, content, author_user_id, author_name, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
    [title, content, req.user!.id, userName]
  );
  await logActivity({ userId: req.user!.id, userName, action: "created", entityType: "coaches_message", entityId: result.rows[0].id, entityName: title });
  const prefs = await pool.query(`
    SELECT notification_email, notification_phone, coach_messages_email, coach_messages_text
    FROM notification_preferences WHERE (coach_messages_email = TRUE OR coach_messages_text = TRUE)
      AND (notification_email IS NOT NULL OR notification_phone IS NOT NULL)
  `);
  for (const pref of prefs.rows) {
    if (pref.coach_messages_email && pref.notification_email) {
      await sendEmail({
        to: pref.notification_email,
        subject: `Coaches Portal: ${title}`,
        html: `<h2>New Message in Coaches Portal</h2><p><strong>From:</strong> ${userName}</p><p><strong>Subject:</strong> ${title}</p><p>${content.replace(/\n/g, "<br>")}</p>`,
      }).catch(err => console.error("Failed to send coach message notification:", err));
    }
  }
  res.json({ id: result.rows[0].id });
});

coachesRouter.post("/coaches/messages/:id/replies", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const userName = getUserDisplayName(req.user!);
  const result = await pool.query(
    `INSERT INTO coaches_message_replies (message_id, content, author_user_id, author_name, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id`,
    [req.params.id, content, req.user!.id, userName]
  );
  await logActivity({ userId: req.user!.id, userName, action: "replied", entityType: "coaches_message", entityId: Number(req.params.id), details: "Added a reply" });
  res.json({ id: result.rows[0].id });
});

coachesRouter.put("/coaches/messages/:id/pin", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const message = await pool.query("SELECT is_pinned FROM coaches_messages WHERE id=$1", [req.params.id]);
  if (!message.rows[0]) { res.status(404).json({ error: "Message not found" }); return; }
  const newPin = !message.rows[0].is_pinned;
  await pool.query("UPDATE coaches_messages SET is_pinned=$1, updated_at=NOW() WHERE id=$2", [newPin, req.params.id]);
  res.json({ success: true, is_pinned: newPin });
});

coachesRouter.delete("/coaches/messages/:id", requireAuth, async (req, res) => {
  if (!(await requireCoachOrAdmin(req.user!.id, req.user!.email))) { res.status(403).json({ error: "Forbidden" }); return; }
  const message = await pool.query("SELECT title FROM coaches_messages WHERE id=$1", [req.params.id]);
  await pool.query("DELETE FROM coaches_message_replies WHERE message_id=$1", [req.params.id]);
  await pool.query("DELETE FROM coaches_messages WHERE id=$1", [req.params.id]);
  if (message.rows[0]) {
    await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "deleted", entityType: "coaches_message", entityId: Number(req.params.id), entityName: message.rows[0].title });
  }
  res.json({ success: true });
});
