/**
 * Migrate files from Cloudflare R2 to Supabase Storage.
 * Usage: npx tsx scripts/migrate-r2-storage.ts [--dry-run]
 *
 * Requires:
 *   - wrangler authenticated (npx wrangler login)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * R2 bucket: 019b7617-c3ef-76fd-99cc-e86fca2684d0
 * The bucket prefixes map to Supabase buckets:
 *   player-photos/   → player-photos   (public)
 *   gallery/         → gallery-photos  (public)
 *   team-documents/  → team-documents  (private)
 *   documents/       → documents       (private)
 *   coaches-documents/ → coach-documents (private)
 */

import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const R2_BUCKET = "019b7617-c3ef-76fd-99cc-e86fca2684d0";
const dryRun = process.argv.includes("--dry-run");

if (dryRun) console.log("[dry-run] No files will be uploaded.\n");

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Maps R2 key prefix → { supabaseBucket, stripPrefix }
const BUCKET_MAP: Array<{
  prefix: string;
  supabaseBucket: string;
  stripPrefix: string;
}> = [
  { prefix: "player-photos/", supabaseBucket: "player-photos", stripPrefix: "player-photos/" },
  { prefix: "gallery/", supabaseBucket: "gallery-photos", stripPrefix: "gallery/" },
  { prefix: "team-documents/", supabaseBucket: "team-documents", stripPrefix: "team-documents/" },
  { prefix: "documents/", supabaseBucket: "documents", stripPrefix: "documents/" },
  { prefix: "coaches-documents/", supabaseBucket: "coach-documents", stripPrefix: "coaches-documents/" },
];

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
};

function contentType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function listR2Objects(): string[] {
  try {
    const raw = execSync(
      `npx wrangler r2 object list "${R2_BUCKET}" --json`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString();
    const parsed = JSON.parse(raw);
    // wrangler r2 object list --json returns { objects: [{key, size, ...}] }
    const objects: Array<{ key: string }> = parsed?.objects ?? parsed ?? [];
    return objects.map((o) => o.key);
  } catch (err) {
    console.error("Failed to list R2 objects:", err);
    process.exit(1);
  }
}

function downloadR2Object(key: string): Buffer {
  const raw = execSync(
    `npx wrangler r2 object get "${R2_BUCKET}/${key}" --pipe`,
    { maxBuffer: 50 * 1024 * 1024 }
  );
  return raw;
}

async function uploadToSupabase(
  bucket: string,
  path: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(error.message);
}

async function main() {
  console.log("Listing R2 objects...");
  const keys = listR2Objects();
  console.log(`Found ${keys.length} objects.\n`);

  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const key of keys) {
    const mapping = BUCKET_MAP.find((m) => key.startsWith(m.prefix));
    if (!mapping) {
      console.log(`  [skip] ${key} — no bucket mapping`);
      skipped++;
      continue;
    }

    const destPath = key.slice(mapping.stripPrefix.length);
    const mime = contentType(key);
    process.stdout.write(`  ${key} → ${mapping.supabaseBucket}/${destPath}... `);

    if (dryRun) {
      console.log("(dry-run)");
      migrated++;
      continue;
    }

    try {
      const buffer = downloadR2Object(key);
      await uploadToSupabase(mapping.supabaseBucket, destPath, buffer, mime);
      console.log("ok");
      migrated++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${message}`);
      errors.push(`${key}: ${message}`);
    }
  }

  console.log(`\nDone. ${migrated} migrated, ${skipped} skipped.`);
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}

main();
