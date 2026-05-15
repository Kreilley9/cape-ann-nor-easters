/**
 * Upload local assets to Supabase Storage 'assets' bucket.
 * Generates asset-url-map.json mapping old Mocha CDN URLs → new Supabase public URLs.
 *
 * Usage:
 *   npx tsx scripts/upload-assets.ts [folder-path]
 *
 * Defaults to: C:\Users\reill\Projects\cape-ann-nor-easters\Website Images
 * Output:      asset-url-map.json  (written to project root)
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";

config();

const BUCKET = "assets";
const MOCHA_BASE = "https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com";
const DEFAULT_FOLDER = "C:\\Users\\reill\\Projects\\cape-ann-nor-easters\\Website Images";
const LOCAL_FOLDER = process.argv[2] ?? DEFAULT_FOLDER;
const MAP_OUTPUT = path.join(process.cwd(), "asset-url-map.json");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
};

function mimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function walkDir(dir: string, base: string): Array<{ abs: string; rel: string }> {
  const results: Array<{ abs: string; rel: string }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      results.push(...walkDir(abs, base));
    } else if (entry.isFile()) {
      results.push({ abs, rel });
    }
  }
  return results;
}

async function ensureBucket(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Failed to create bucket '${BUCKET}': ${error.message}`);
    console.log(`Created bucket '${BUCKET}' (public).\n`);
  }
}

async function main() {
  if (!fs.existsSync(LOCAL_FOLDER)) {
    console.error(`ERROR: Folder not found: ${LOCAL_FOLDER}`);
    process.exit(1);
  }

  await ensureBucket();

  const files = walkDir(LOCAL_FOLDER, LOCAL_FOLDER);
  console.log(`Uploading ${files.length} file(s) from:\n  ${LOCAL_FOLDER}\n`);

  // Load any existing map so re-runs are additive
  let urlMap: Record<string, string> = {};
  if (fs.existsSync(MAP_OUTPUT)) {
    try {
      urlMap = JSON.parse(fs.readFileSync(MAP_OUTPUT, "utf8"));
    } catch {
      // start fresh if the file is malformed
    }
  }

  let uploaded = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { abs, rel } of files) {
    const mime = mimeType(rel);
    const buffer = fs.readFileSync(abs);

    process.stdout.write(`  ${rel} ... `);

    try {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(rel, buffer, { contentType: mime, upsert: true });

      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(rel);
      const publicUrl = data.publicUrl;

      // Old Mocha CDN URL uses the bare filename (flat storage, no subdirectory)
      const mochaUrl = `${MOCHA_BASE}/${path.basename(rel)}`;
      urlMap[mochaUrl] = publicUrl;

      console.log(publicUrl);
      uploaded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // "already exists" with upsert: true shouldn't happen, but treat it as skipped
      if (message.includes("already exists")) {
        console.log("already exists (skipped)");
        skipped++;
      } else {
        console.log(`ERROR: ${message}`);
        errors.push(`${rel}: ${message}`);
      }
    }
  }

  fs.writeFileSync(MAP_OUTPUT, JSON.stringify(urlMap, null, 2));

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Uploaded : ${uploaded}`);
  if (skipped > 0) console.log(`Skipped  : ${skipped}`);
  if (errors.length > 0) console.log(`Errors   : ${errors.length}`);
  console.log(`Map file : ${MAP_OUTPUT}`);

  if (errors.length > 0) {
    console.log("\nFailed files:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
}

main();
