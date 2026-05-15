/**
 * Export all D1 tables to JSON files in ./migration-data/
 * Usage: npx tsx scripts/export-d1.ts
 *
 * Requires wrangler to be installed and authenticated:
 *   npx wrangler login
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DB_NAME = "019b7617-c3ef-76fd-99cc-e86fca2684d0";
const OUTPUT_DIR = join(process.cwd(), "migration-data");

const TABLES = [
  "admins",
  "user_roles",
  "invites",
  "user_permissions",
  "seasons",
  "teams",
  "team_seasons",
  "families",
  "players",
  "team_players",
  "team_coaches",
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
  "coaches",
  "boards",
  "reservations",
  "raffles",
  "raffle_tickets",
  "raffle_sellers",
  "activity_log",
  "tryout_config",
  "site_config",
];

mkdirSync(OUTPUT_DIR, { recursive: true });

let totalRows = 0;
const errors: string[] = [];

for (const table of TABLES) {
  process.stdout.write(`Exporting ${table}... `);
  try {
    const raw = execSync(
      `npx wrangler d1 execute "${DB_NAME}" --command "SELECT * FROM ${table}" --json`,
      { maxBuffer: 100 * 1024 * 1024 }
    ).toString();

    // Wrangler --json output is an array of result objects; rows are in results[0].results
    const parsed = JSON.parse(raw);
    const rows: unknown[] = Array.isArray(parsed)
      ? (parsed[0]?.results ?? [])
      : (parsed?.results ?? []);

    const outPath = join(OUTPUT_DIR, `${table}.json`);
    writeFileSync(outPath, JSON.stringify(rows, null, 2));
    console.log(`${rows.length} rows`);
    totalRows += rows.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`ERROR: ${message.split("\n")[0]}`);
    errors.push(`${table}: ${message.split("\n")[0]}`);
  }
}

console.log(`\nDone. ${totalRows} total rows exported to ${OUTPUT_DIR}`);
if (errors.length > 0) {
  console.log("\nErrors:");
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
