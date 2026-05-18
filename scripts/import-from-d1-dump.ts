/**
 * Import data from a Cloudflare D1 SQLite dump into Supabase PostgreSQL.
 *
 * Usage:
 *   npx tsx scripts/import-from-d1-dump.ts [--dry-run] [--table=<name>]
 *
 * Place d1_dump.sql in the project root before running.
 * Reads DATABASE_URL from .env
 *
 * What it does:
 *   - Parses SQLite CREATE TABLE statements to derive column names
 *   - Parses INSERT INTO VALUES(...) using a tokenizer that handles
 *     single-quoted strings, '' escaping, NULL, numbers, and X'' blobs
 *   - Filters each row to only columns that exist in PostgreSQL
 *     (handles D1↔PG schema differences gracefully)
 *   - Converts 0/1 integers → boolean, JSON text → objects
 *   - Clears then re-inserts each table in dependency order
 *   - Resets BIGSERIAL sequences after import
 */

import { Pool, type PoolClient } from "pg";
import { readFileSync } from "fs";
import { config } from "dotenv";

config();

const DUMP_FILE = "d1_dump.sql";
const BATCH_SIZE = 200;
const dryRun = process.argv.includes("--dry-run");
const tableArg = process.argv.find((a) => a.startsWith("--table="))?.split("=")[1];

if (dryRun) console.log("[dry-run] No data will be written.\n");

// ─── Table import order (parents before children) ──────────────────────────

const TABLE_ORDER = [
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

// ─── Column type mappings ──────────────────────────────────────────────────

// SQLite stores these as 0/1 integers; PostgreSQL expects true/false
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  seasons:       ["is_active"],
  teams:         ["is_active"],
  team_players:  ["is_active"],
  team_coaches:  ["is_active"],
  events:        ["is_cancelled", "is_active"],
  players:       ["is_female", "has_flag_sets", "is_active"],
  calendar_subscriptions: ["is_active"],
  uniform_orders: ["is_female", "has_flag_sets"],
  survey_questions: ["is_required"],
  team_messages:    ["is_pinned"],
  coaches_messages: ["is_pinned"],
  notification_preferences: [
    "schedule_changes_email", "schedule_changes_text",
    "rsvp_requests_email",    "rsvp_requests_text",
    "team_messages_email",    "team_messages_text",
    "coach_messages_email",   "coach_messages_text",
    "documents_email",        "documents_text",
    "payment_reminders_email","payment_reminders_text",
  ],
  news_posts:    ["is_published"],
  gallery_photos:["is_visible"],
  coaches:       ["is_visible"],
  boards:        ["is_open"],
  raffles:       ["is_open"],
  raffle_tickets:["is_paid"],
  tryout_config: ["is_enabled"],
};

// SQLite stores these as JSON text; PostgreSQL expects parsed objects (JSONB)
const JSONB_COLUMNS: Record<string, string[]> = {
  group_messages: ["team_ids"],
  boards:         ["payouts", "top_nums", "side_nums", "scores"],
};

// ─── SQLite dump parser ────────────────────────────────────────────────────

/**
 * Splits SQL source into individual statements, respecting single-quoted
 * string literals (including '' escape sequences) and -- / block comments.
 */
function tokenizeStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const nx = sql[i + 1] ?? "";

    if (inLine)  { if (ch === "\n") inLine = false; continue; }
    if (inBlock) { if (ch === "*" && nx === "/") { inBlock = false; i++; } continue; }

    if (!inString && ch === "-" && nx === "-") { inLine = true;  i++; continue; }
    if (!inString && ch === "/" && nx === "*") { inBlock = true; i++; continue; }

    if (inString) {
      current += ch;
      if (ch === "'" && nx === "'") { current += nx; i++; } // '' escape
      else if (ch === "'") inString = false;
    } else {
      if (ch === "'") { inString = true; current += ch; }
      else if (ch === ";") {
        const s = current.trim();
        if (s) statements.push(s);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  const s = current.trim();
  if (s) statements.push(s);
  return statements;
}

/**
 * Extracts ordered column names from the body of a CREATE TABLE statement
 * (the content between the outer parentheses), splitting on commas at
 * depth 0 to skip nested PRIMARY KEY / UNIQUE constraint expressions.
 */
function extractColumnNames(body: string): string[] {
  const columns: string[] = [];
  let depth = 0;
  let current = "";
  let inStr = false;

  for (const ch of body) {
    if (inStr) {
      current += ch;
      if (ch === "'") inStr = false;
    } else if (ch === "'") {
      inStr = true; current += ch;
    } else if (ch === "(") {
      depth++; current += ch;
    } else if (ch === ")") {
      depth--; current += ch;
    } else if (ch === "," && depth === 0) {
      const col = parseColName(current.trim());
      if (col) columns.push(col);
      current = "";
    } else {
      current += ch;
    }
  }
  const col = parseColName(current.trim());
  if (col) columns.push(col);
  return columns;
}

function parseColName(def: string): string | null {
  if (/^(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|CONSTRAINT)\b/i.test(def)) return null;
  const m = def.match(/^"([^"]+)"|^(\w+)/);
  return m ? (m[1] ?? m[2]) : null;
}

/**
 * Evaluate a small subset of SQLite scalar functions used by D1 exports.
 * D1's wrangler dump encodes multi-line text as replace('text\nmore','\n',char(10)).
 */
function evalSqliteFunc(name: string, args: unknown[]): unknown {
  switch (name.toUpperCase()) {
    case "CHAR":
      return typeof args[0] === "number" ? String.fromCharCode(args[0]) : null;
    case "REPLACE": {
      const [s, from, to] = args;
      if (typeof s === "string" && typeof from === "string" && typeof to === "string") {
        return s.split(from).join(to);
      }
      return s ?? null;
    }
    default:
      return null;
  }
}

/**
 * Tokenizes a SQLite VALUES string into typed JavaScript values.
 * Handles: 'string', '' escape, NULL, integer/real, X'hex' blobs,
 * and SQLite function calls like replace(...) / char(n) that D1 uses
 * to encode multi-line text fields.
 */
function tokenizeValues(str: string): unknown[] {
  const values: unknown[] = [];
  let i = 0;

  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    const ch = str[i];

    if (ch === "'") {
      // Single-quoted string literal
      let s = "";
      i++;
      while (i < str.length) {
        if (str[i] === "'" && str[i + 1] === "'") { s += "'"; i += 2; }
        else if (str[i] === "'") { i++; break; }
        else s += str[i++];
      }
      values.push(s);
    } else if ((ch === "X" || ch === "x") && str[i + 1] === "'") {
      // Blob literal — store as base64 string
      i += 2;
      let hex = "";
      while (i < str.length && str[i] !== "'") hex += str[i++];
      if (str[i] === "'") i++;
      values.push(hex ? Buffer.from(hex, "hex").toString("base64") : null);
    } else if (/[a-zA-Z_]/.test(ch)) {
      // Identifier or function call (NULL, TRUE, FALSE, replace, char, ...)
      let name = "";
      while (i < str.length && /[a-zA-Z_0-9]/.test(str[i])) name += str[i++];

      if (i < str.length && str[i] === "(") {
        // Function call — find the matching close paren, respecting nested
        // parens and string literals inside the argument list.
        let depth = 0;
        const start = i;
        let inStr = false;
        while (i < str.length) {
          const c = str[i];
          if (inStr) {
            if (c === "'" && str[i + 1] === "'") i++; // '' escape
            else if (c === "'") inStr = false;
          } else if (c === "'") {
            inStr = true;
          } else if (c === "(") {
            depth++;
          } else if (c === ")") {
            depth--;
            if (depth === 0) { i++; break; }
          }
          i++;
        }
        const inner = str.slice(start + 1, i - 1);
        const args = tokenizeValues(inner); // parse args recursively
        values.push(evalSqliteFunc(name, args));
      } else {
        const upper = name.toUpperCase();
        if (upper === "NULL")        values.push(null);
        else if (upper === "TRUE")   values.push(true);
        else if (upper === "FALSE")  values.push(false);
        else if (!isNaN(Number(name))) values.push(Number(name));
        else values.push(name);
      }
    } else {
      // Numeric literal (possibly negative)
      let token = "";
      while (i < str.length && str[i] !== "," && !/\s/.test(str[i])) token += str[i++];
      if (token !== "") {
        values.push(!isNaN(Number(token)) ? Number(token) : token);
      }
    }

    while (i < str.length && /\s/.test(str[i])) i++;
    if (i < str.length && str[i] === ",") i++;
  }

  return values;
}

interface TableDump {
  columns: string[];
  rows: Record<string, unknown>[];
}

/** Parse the full dump file → per-table column list + rows */
function parseDump(sql: string): Map<string, TableDump> {
  const tableColumns = new Map<string, string[]>();
  const tableData    = new Map<string, TableDump>();

  for (const stmt of tokenizeStatements(sql)) {
    const upper = stmt.trimStart().toUpperCase();

    if (upper.startsWith("CREATE TABLE")) {
      const nameMatch = stmt.match(
        /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"([^"]+)"|(\w+))\s*\(/i
      );
      if (!nameMatch) continue;
      const table = (nameMatch[1] ?? nameMatch[2]).trim();

      const open  = stmt.indexOf("(");
      const close = stmt.lastIndexOf(")");
      if (open === -1 || close === -1) continue;

      const columns = extractColumnNames(stmt.slice(open + 1, close));
      tableColumns.set(table, columns);
      if (!tableData.has(table)) tableData.set(table, { columns, rows: [] });

    } else if (upper.startsWith("INSERT INTO")) {
      // Table name
      const nameMatch = stmt.match(/INSERT INTO\s+(?:"([^"]+)"|(\w+))/i);
      if (!nameMatch) continue;
      const table = (nameMatch[1] ?? nameMatch[2]).trim();

      // Determine column order — prefer explicit list in INSERT, fall back to CREATE TABLE
      let columns = tableColumns.get(table);
      const explicitMatch = stmt.match(
        /INSERT INTO\s+(?:"[^"]+"|[^(\s]+)\s*\(([^)]+)\)\s+VALUES/i
      );
      if (explicitMatch) {
        columns = explicitMatch[1]
          .split(",")
          .map((c) => c.trim().replace(/^"|"$/g, ""));
      }
      if (!columns) continue;

      // Extract VALUES(...) body
      const vIdx = stmt.search(/VALUES\s*\(/i);
      if (vIdx === -1) continue;
      const open  = stmt.indexOf("(", vIdx);
      const close = stmt.lastIndexOf(")");
      if (open === -1 || close === -1 || close <= open) continue;
      const valuesStr = stmt.slice(open + 1, close);

      const values = tokenizeValues(valuesStr);
      const row: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = i < values.length ? values[i] : null;
      }

      if (!tableData.has(table)) tableData.set(table, { columns, rows: [] });
      tableData.get(table)!.rows.push(row);
    }
  }

  return tableData;
}

// ─── Row transformation ────────────────────────────────────────────────────

function transformRow(
  table: string,
  row: Record<string, unknown>,
  pgColumns: Set<string>
): Record<string, unknown> {
  // Drop columns that don't exist in PostgreSQL (handles D1↔PG schema gaps)
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (pgColumns.has(k)) out[k] = v;
  }

  // 0/1 → boolean
  for (const col of BOOLEAN_COLUMNS[table] ?? []) {
    if (col in out && out[col] !== null && out[col] !== undefined) {
      out[col] = out[col] === 1 || out[col] === true || out[col] === "1";
    }
  }

  // Validate JSON text for JSONB columns but keep as string — node-postgres
  // passes strings through directly to PostgreSQL, which parses them natively.
  // Parsing to a JS object here causes pg to call .toString() → "[object Object]".
  for (const col of JSONB_COLUMNS[table] ?? []) {
    if (col in out && out[col] !== null && typeof out[col] === "string") {
      try {
        JSON.parse(out[col] as string); // validate only — keep as string
      } catch {
        out[col] = null; // malformed JSON → null rather than crashing
      }
    }
  }

  return out;
}

// ─── PostgreSQL helpers ────────────────────────────────────────────────────

async function getPgColumns(client: PoolClient, table: string): Promise<Set<string>> {
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(res.rows.map((r) => r.column_name));
}

async function importTable(pool: Pool, table: string, dump: TableDump): Promise<void> {
  if (dump.rows.length === 0) {
    console.log(`  [skip] ${table} — 0 rows`);
    return;
  }

  process.stdout.write(`  ${table}: ${dump.rows.length} rows... `);

  if (dryRun) { console.log("(dry-run)"); return; }

  const client = await pool.connect();
  try {
    const pgColumns = await getPgColumns(client, table);
    if (pgColumns.size === 0) {
      console.log(`[skip] not found in PostgreSQL`);
      return;
    }

    await client.query("BEGIN");
    await client.query(`DELETE FROM "${table}"`);

    let inserted = 0;
    for (let i = 0; i < dump.rows.length; i += BATCH_SIZE) {
      for (const rawRow of dump.rows.slice(i, i + BATCH_SIZE)) {
        const row  = transformRow(table, rawRow, pgColumns);
        const cols = Object.keys(row);
        if (cols.length === 0) continue;

        const colList      = cols.map((c) => `"${c}"`).join(", ");
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ");
        const vals         = cols.map((c) => row[c] ?? null);

        await client.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
          vals
        );
        inserted++;
      }
    }

    // Reset sequence so future inserts don't collide with migrated IDs
    if (pgColumns.has("id")) {
      await client.query(
        `SELECT setval(
           pg_get_serial_sequence('"${table}"', 'id'),
           COALESCE((SELECT MAX(id) FROM "${table}"), 1)
         )`
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

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL must be set in .env");
    process.exit(1);
  }

  let sql: string;
  try {
    sql = readFileSync(DUMP_FILE, "utf8");
  } catch {
    console.error(
      `ERROR: Could not read ${DUMP_FILE}\n` +
      `       Place the D1 dump file in the project root and re-run.`
    );
    process.exit(1);
  }

  console.log(`Parsing ${DUMP_FILE}...`);
  const dumpData = parseDump(sql);
  console.log(`Found ${dumpData.size} tables in dump.\n`);

  // Warn about tables in the dump that aren't in our import order
  const unknown = [...dumpData.keys()].filter((t) => !TABLE_ORDER.includes(t));
  if (unknown.length > 0) {
    console.log(`Tables in dump not in import order (skipped): ${unknown.join(", ")}\n`);
  }

  const tablesToRun = tableArg
    ? [tableArg]
    : TABLE_ORDER.filter((t) => dumpData.has(t));

  console.log(`Importing ${tablesToRun.length} table(s) into PostgreSQL...\n`);

  const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
  const errors: string[] = [];

  for (const table of tablesToRun) {
    const data = dumpData.get(table);
    if (!data) {
      console.log(`  [skip] ${table} — not in dump`);
      continue;
    }
    try {
      await importTable(pool, table, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg}`);
      errors.push(`${table}: ${msg}`);
    }
  }

  await pool.end();

  console.log("\nImport complete.");
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}

main();
