import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Initialize S3 Client for Cloudflare R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

/**
 * Upload a file to Cloudflare R2
 * @param fileBuffer - The file buffer to upload
 * @param fileName - Unique filename to use in R2
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });

    await upload.done();
    
    // Return the public URL
    return `${R2_PUBLIC_URL}/${fileName}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload file to storage');
  }
}

/**
 * Delete a file from Cloudflare R2
 * @param fileName - The filename to delete
 */
export async function deleteFromR2(fileName: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw new Error('Failed to delete file from storage');
  }
}

/**
 * Get a file from Cloudflare R2
 * @param fileName - The filename to retrieve
 * @returns The file stream
 */
export async function getFromR2(fileName: string) {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
    });

    const response = await r2Client.send(command);
    return response;
  } catch (error) {
    console.error('Error getting file from R2:', error);
    throw new Error('Failed to retrieve file from storage');
  }
}

/**
 * Generate public URL for a file
 * @param fileName - The filename
 * @returns The public URL
 */
export function getPublicUrl(fileName: string): string {
  return `${R2_PUBLIC_URL}/${fileName}`;
}

/**
 * Extract filename from public URL
 * @param url - The public URL
 * @returns The filename
 */
export function extractFileNameFromUrl(url: string): string {
  return url.replace(`${R2_PUBLIC_URL}/`, '');
}
