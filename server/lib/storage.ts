import { supabase } from "./supabase.ts";

export const BUCKETS = {
  PLAYER_PHOTOS: "player-photos",
  TEAM_DOCUMENTS: "team-documents",
  GALLERY_PHOTOS: "gallery-photos",
  DOCUMENTS: "documents",
  COACH_DOCUMENTS: "coach-documents",
} as const;

export async function uploadFile(
  bucket: string,
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
}

export function getPublicUrl(bucket: string, filePath: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

export async function downloadFile(bucket: string, filePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);
  if (error) throw new Error(`Storage download failed: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
