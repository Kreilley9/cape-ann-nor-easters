import { Router } from "express";
import { pool } from "../lib/db.ts";
import { requireAuth } from "../middleware/auth.ts";
import { isAdmin, getUserRoles, getFamilyId } from "../middleware/roles.ts";
import { logActivity, getUserDisplayName } from "../lib/activity-logger.ts";

export const surveysRouter = Router();

surveysRouter.post("/surveys", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const isParent = roles.some(r => r.role === "parent");
  const familyId = await getFamilyId(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);

  if (!adminCheck && !isCoach && !isParent) {
    res.status(403).json({ error: "Forbidden - you do not have permission to create surveys" }); return;
  }

  const { title, description, target_type, team_ids, expires_at, questions, family_ids, player_ids } = req.body;
  if (!adminCheck && team_ids?.length > 0) {
    if (isCoach) {
      const invalid = team_ids.filter((tid: number) => !coachTeamIds.includes(tid));
      if (invalid.length > 0) { res.status(403).json({ error: "You can only create surveys for teams you coach" }); return; }
    } else if (isParent && familyId) {
      const teamRes = await pool.query(`SELECT DISTINCT tp.team_id FROM team_players tp JOIN players p ON tp.player_id = p.id WHERE p.family_id = $1`, [familyId]);
      const allowedIds = teamRes.rows.map(r => r.team_id);
      const invalid = team_ids.filter((tid: number) => !allowedIds.includes(tid));
      if (invalid.length > 0) { res.status(403).json({ error: "You can only create surveys for your children's teams" }); return; }
    }
  }

  const surveyResult = await pool.query(`
    INSERT INTO surveys (title, description, target_type, team_ids, expires_at, is_active, created_by_user_id, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,TRUE,$6,NOW(),NOW()) RETURNING id`,
    [title, description || null, target_type, team_ids ? JSON.stringify(team_ids) : null, expires_at || null, req.user!.id]
  );
  const surveyId = surveyResult.rows[0].id;

  for (let i = 0; i < (questions || []).length; i++) {
    const q = questions[i];
    await pool.query(`
      INSERT INTO survey_questions (survey_id, question_text, question_type, options, is_required, order_index, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
      [surveyId, q.question_text, q.question_type, q.options || null, !!q.is_required, i]
    );
  }

  if (target_type === "all") {
    const families = await pool.query("SELECT id FROM families");
    for (const f of families.rows) {
      await pool.query(`INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at) VALUES ($1,$2,NOW(),NOW())`, [surveyId, f.id]);
    }
  } else if (target_type === "team" && team_ids?.length > 0) {
    const placeholders = team_ids.map((_: unknown, i: number) => `$${i + 1}`).join(",");
    const families = await pool.query(`SELECT DISTINCT p.family_id FROM players p JOIN team_players tp ON p.id = tp.player_id WHERE tp.team_id IN (${placeholders})`, team_ids);
    for (const f of families.rows) {
      await pool.query(`INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at) VALUES ($1,$2,NOW(),NOW())`, [surveyId, f.family_id]);
    }
  } else if (target_type === "custom") {
    for (const fid of (family_ids || [])) {
      await pool.query(`INSERT INTO survey_recipients (survey_id, family_id, created_at, updated_at) VALUES ($1,$2,NOW(),NOW())`, [surveyId, fid]);
    }
    for (const pid of (player_ids || [])) {
      await pool.query(`INSERT INTO survey_recipients (survey_id, player_id, created_at, updated_at) VALUES ($1,$2,NOW(),NOW())`, [surveyId, pid]);
    }
  }

  await logActivity({ userId: req.user!.id, userName: getUserDisplayName(req.user!), action: "created", entityType: "survey", entityId: surveyId, entityName: title, details: `${target_type} - ${(questions || []).length} questions` });
  res.status(201).json({ id: surveyId, success: true });
});

surveysRouter.get("/surveys", requireAuth, async (req, res) => {
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const isParent = roles.some(r => r.role === "parent");
  const familyId = await getFamilyId(req.user!.id);
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);

  const result = await pool.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM survey_recipients WHERE survey_id = s.id) as recipient_count,
      (SELECT COUNT(*) FROM survey_responses WHERE survey_id = s.id) as response_count
    FROM surveys s ORDER BY s.created_at DESC
  `);

  let surveys = result.rows;
  if (!adminCheck) {
    surveys = surveys.filter(s => {
      if (!s.team_ids) return false;
      const teamIds = JSON.parse(s.team_ids);
      if (isCoach) return teamIds.some((tid: number) => coachTeamIds.includes(tid));
      if (isParent && familyId) return s.created_by_user_id === req.user!.id;
      return false;
    });
  }
  res.json(surveys);
});

surveysRouter.get("/surveys/:id", requireAuth, async (req, res) => {
  const survey = await pool.query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!survey.rows[0]) { res.status(404).json({ error: "Survey not found" }); return; }
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const familyIds = roles.filter(r => r.family_id).map(r => r.family_id!);
  const isCreator = survey.rows[0].created_by_user_id === req.user!.id;

  if (!adminCheck && !isCreator && familyIds.length > 0) {
    const fPhs = familyIds.map((_, i) => `$${i + 2}`).join(",");
    const recResult = await pool.query(
      `SELECT * FROM survey_recipients WHERE survey_id = $1 AND (family_id IN (${fPhs}) OR player_id IN (SELECT id FROM players WHERE family_id IN (${fPhs})))`,
      [req.params.id, ...familyIds, ...familyIds]
    );
    if (!recResult.rows.length) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (!adminCheck && !isCreator && familyIds.length === 0) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const questions = await pool.query("SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY order_index", [req.params.id]);

  let alreadyResponded = false;
  if (familyIds.length > 0) {
    const fPhs = familyIds.map((_, i) => `$${i + 2}`).join(",");
    const existing = await pool.query(
      `SELECT id FROM survey_responses WHERE survey_id = $1 AND (family_id IN (${fPhs}) OR submitted_by_user_id = $${familyIds.length + 2}) LIMIT 1`,
      [req.params.id, ...familyIds, req.user!.id]
    );
    alreadyResponded = existing.rows.length > 0;
  }

  res.json({ survey: survey.rows[0], questions: questions.rows, already_responded: alreadyResponded });
});

surveysRouter.delete("/surveys/:id", requireAuth, async (req, res) => {
  const survey = await pool.query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!survey.rows[0]) { res.status(404).json({ error: "Survey not found" }); return; }
  const s = survey.rows[0];
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);
  const surveyTeamIds = s.team_ids ? JSON.parse(s.team_ids) : [];
  const canDelete = adminCheck || s.created_by_user_id === req.user!.id || (isCoach && surveyTeamIds.some((tid: number) => coachTeamIds.includes(tid)));
  if (!canDelete) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM survey_answers WHERE response_id IN (SELECT id FROM survey_responses WHERE survey_id = $1)", [req.params.id]);
  await pool.query("DELETE FROM survey_responses WHERE survey_id = $1", [req.params.id]);
  await pool.query("DELETE FROM survey_recipients WHERE survey_id = $1", [req.params.id]);
  await pool.query("DELETE FROM survey_questions WHERE survey_id = $1", [req.params.id]);
  await pool.query("DELETE FROM surveys WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

surveysRouter.post("/surveys/:id/response", requireAuth, async (req, res) => {
  const survey = await pool.query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!survey.rows[0]) { res.status(404).json({ error: "Survey not found" }); return; }
  const s = survey.rows[0];
  if (!s.is_active) { res.status(400).json({ error: "Survey is closed" }); return; }
  if (s.expires_at && new Date(s.expires_at) < new Date()) { res.status(400).json({ error: "Survey has expired" }); return; }
  const roles = await getUserRoles(req.user!.id);
  const familyIds = roles.filter(r => r.family_id).map(r => r.family_id!);
  const familyId = familyIds[0] || null;
  if (familyId) {
    const existing = await pool.query(`SELECT id FROM survey_responses WHERE survey_id = $1 AND (family_id = $2 OR submitted_by_user_id = $3) LIMIT 1`, [req.params.id, familyId, req.user!.id]);
    if (existing.rows.length > 0) { res.status(400).json({ error: "You have already responded to this survey" }); return; }
  }
  const responseResult = await pool.query(`INSERT INTO survey_responses (survey_id, family_id, submitted_by_user_id, submitted_at, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW(),NOW()) RETURNING id`, [req.params.id, familyId, req.user!.id]);
  const responseId = responseResult.rows[0].id;
  const { answers } = req.body;
  for (const [questionId, answerText] of Object.entries(answers || {})) {
    if (answerText && String(answerText).trim()) {
      await pool.query(`INSERT INTO survey_answers (response_id, question_id, answer_text, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [responseId, parseInt(questionId), String(answerText)]);
    }
  }
  res.json({ success: true, response_id: responseId });
});

surveysRouter.get("/surveys/:id/results", requireAuth, async (req, res) => {
  const survey = await pool.query("SELECT * FROM surveys WHERE id = $1", [req.params.id]);
  if (!survey.rows[0]) { res.status(404).json({ error: "Survey not found" }); return; }
  const s = survey.rows[0];
  const adminCheck = await isAdmin(req.user!.id, req.user!.email);
  const roles = await getUserRoles(req.user!.id);
  const isCoach = roles.some(r => r.role === "coach");
  const coachTeamIds = roles.filter(r => r.role === "coach" && r.team_id).map(r => r.team_id!);
  if (!adminCheck) {
    const surveyTeamIds = s.team_ids ? JSON.parse(s.team_ids) : [];
    if (isCoach) {
      const hasAccess = surveyTeamIds.some((tid: number) => coachTeamIds.includes(tid));
      if (!hasAccess && s.created_by_user_id !== req.user!.id) { res.status(403).json({ error: "Forbidden" }); return; }
    } else if (s.created_by_user_id !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  }
  const questions = await pool.query("SELECT * FROM survey_questions WHERE survey_id = $1 ORDER BY order_index", [req.params.id]);
  const responses = await pool.query(`
    SELECT sr.*, f.name as family_name, p.first_name, p.last_name
    FROM survey_responses sr
    LEFT JOIN families f ON sr.family_id = f.id
    LEFT JOIN players p ON sr.player_id = p.id
    WHERE sr.survey_id = $1 ORDER BY sr.submitted_at DESC
  `, [req.params.id]);
  for (const response of responses.rows) {
    const answers = await pool.query(`
      SELECT sa.*, sq.question_text, sq.question_type FROM survey_answers sa
      JOIN survey_questions sq ON sa.question_id = sq.id
      WHERE sa.response_id = $1 ORDER BY sq.order_index
    `, [response.id]);
    response.answers = answers.rows;
  }
  res.json({ survey: s, questions: questions.rows, responses: responses.rows });
});
