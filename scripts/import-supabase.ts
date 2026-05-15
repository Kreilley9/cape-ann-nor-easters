/**
 * Import exported D1 JSON files into Supabase PostgreSQL.
 * Usage: npx tsx scripts/import-supabase.ts [--table=<name>] [--dry-run]
 *
 * Expects migration-data/<table>.json files from export-d1.ts.
 * Reads DATABASE_URL from .env (or process.env).
 */

import { Pool } from "pg";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DATA_DIR = join(process.cwd(), "migration-data");
const BATCH_SIZE = 500;

const args = process.argv.slice(2);
const tableArg = args.find((a) => a.startsWith("--table="))?.split("=")[1];
const dryRun = args.includes("--dry-run");

if (dryRun) console.log("[dry-run] No data will be written.\n");

// Tables in dependency order (parents before children)
const TABLES = [
  "admins",
  "seasons",
  "families",
  "teams",
  "team_seasons",
  "players",
  "team_players",
  "team_coaches",
  "coaches",
  "events",
  "event_invites",
  "attendance",
  "calendar_subscriptions",
  "payments",
  "player_payments",
  "uniform_orders",
  "team_documents",
  "coaches_documents",
  "prospects",
  "prospect_notes",
  "surveys",
  "survey_questions",
  "survey_recipients",
  "survey_responses",
  "survey_answers",
  "team_messages",
  "team_message_replies",
  "coaches_messages",
  "coaches_message_replies",
  "group_messages",
  "group_message_recipients",
  "notification_preferences",
  "news_posts",
  "news_post_images",
  "gallery_photos",
  "boards",
  "reservations",
  "raffles",
  "raffle_tickets",
  "raffle_sellers",
  "activity_log",
  "invites",
  "user_roles",
  "user_permissions",
  "tryout_config",
  "site_config",
];

// Columns that are BOOLEAN in PostgreSQL (stored as 0/1 in SQLite)
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  seasons: ["is_active"],
  teams: ["is_active"],
  events: ["is_cancelled", "is_active"],
  players: ["is_female", "has_flag_sets", "is_active"],
  survey_questions: ["is_required"],
  team_messages: ["is_pinned"],
  coaches_messages: ["is_pinned"],
  notification_preferences: [
    "schedule_changes_email", "schedule_changes_text",
    "rsvp_requests_email", "rsvp_requests_text",
    "team_messages_email", "team_messages_text",
    "coach_messages_email", "coach_messages_text",
    "documents_email", "documents_text",
    "payment_reminders_email", "payment_reminders_text",
  ],
  news_posts: ["is_published"],
  gallery_photos: ["is_visible"],
  coaches: ["is_visible"],
  raffles: ["is_open"],
  raffle_tickets: ["is_paid"],
  tryout_config: ["is_enabled"],
};

// Columns that are JSONB in PostgreSQL (stored as TEXT in SQLite)
const JSONB_COLUMNS: Record<string, string[]> = {
  group_messages: ["team_ids"],
  boards: ["payouts", "top_nums", "side_nums", "scores"],
};

function transformRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };

  // Convert integer booleans
  for (const col of BOOLEAN_COLUMNS[table] ?? []) {
    if (col in out && out[col] !== null && out[col] !== undefined) {
      out[col] = out[col] === 1 || out[col] === true || out[col] === "1";
    }
  }

  // Parse JSON text → object (PostgreSQL accepts objects for JSONB)
  for (const col of JSONB_COLUMNS[table] ?? []) {
    if (col in out && out[col] !== null && typeof out[col] === "string") {
      try {
        out[col] = JSON.parse(out[col] as string);
      } catch {
        // leave as-is; PostgreSQL will reject it if truly malformed
      }
    }
  }

  // SQLite stores dates as TEXT. PostgreSQL TIMESTAMPTZ can parse ISO 8601 strings
  // directly, so no conversion needed — just pass through.

  return out;
}

async function importTable(table: string): Promise<void> {
  const filePath = join(DATA_DIR, `${table}.json`);
  if (!existsSync(filePath)) {
    console.log(`  [skip] ${table} — no export file found`);
    return;
  }

  const raw = readFileSync(filePath, "utf-8");
  const rows: Record<string, unknown>[] = JSON.parse(raw);

  if (rows.length === 0) {
    console.log(`  [skip] ${table} — 0 rows`);
    return;
  }

  process.stdout.write(`  ${table}: ${rows.length} rows... `);

  if (dryRun) {
    console.log("(dry-run, skipping)");
    return;
  }

  const columns = Object.keys(rows[0]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear existing data before import (safe for idempotent re-runs)
    await client.query(`DELETE FROM ${table}`);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      for (const rawRow of batch) {
        const row = transformRow(table, rawRow);
        const vals = columns.map((c) => row[c] ?? null);
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
        const colList = columns.map((c) => `"${c}"`).join(", ");

        await client.query(
          `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
          vals
        );
        inserted++;
      }
    }

    // Reset the BIGSERIAL sequence to max(id) so future inserts don't collide
    if (columns.includes("id")) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`
      );
    }

    await client.query("COMMIT");
    console.log(`done (${inserted} inserted)`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const tablesToRun = tableArg ? [tableArg] : TABLES;

  console.log(`Importing ${tablesToRun.length} table(s) into Supabase...\n`);

  const errors: string[] = [];
  for (const table of tablesToRun) {
    try {
      await importTable(table);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR: ${message}`);
      errors.push(`${table}: ${message}`);
    }
  }

  console.log("\nImport complete.");
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }

  await pool.end();
}

main();
