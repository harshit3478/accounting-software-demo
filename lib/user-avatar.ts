import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { deleteFromR2, uploadToR2 } from "./r2-client";

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export function getAvatarExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export function validateAvatarFile(file: {
  size: number;
  type: string;
}): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return "Avatar must be a JPEG, PNG, WebP, or GIF image";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Avatar must be 2MB or smaller";
  }
  return null;
}

function extractR2KeyFromUrl(url: string): string | null {
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicBase || !url.startsWith(publicBase)) return null;
  return url.slice(publicBase.length + 1);
}

export async function deleteStoredAvatar(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return;

  const r2Key = extractR2KeyFromUrl(avatarUrl);
  if (r2Key) {
    try {
      await deleteFromR2(r2Key);
    } catch {
      // ignore cleanup errors
    }
    return;
  }

  if (avatarUrl.startsWith("/uploads/avatars/")) {
    try {
      const { unlink } = await import("fs/promises");
      const filePath = path.join(process.cwd(), "public", avatarUrl);
      await unlink(filePath);
    } catch {
      // ignore missing file
    }
  }
}

export async function saveAvatarFile(
  userId: number,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const extension = getAvatarExtension(mimeType);
  const fileName = `avatars/user-${userId}-${Date.now()}.${extension}`;

  if (process.env.R2_ACCOUNT_ID && process.env.R2_PUBLIC_URL) {
    return uploadToR2(buffer, fileName, mimeType);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars");
  await mkdir(uploadsDir, { recursive: true });
  const localName = `user-${userId}.${extension}`;
  await writeFile(path.join(uploadsDir, localName), buffer);
  return `/uploads/avatars/${localName}`;
}
