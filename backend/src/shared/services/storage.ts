import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const s3 = new S3Client({ region: env.awsRegion });

/**
 * Upload a file to S3.
 */
export async function uploadFile(
  key: string,
  body: Buffer | string,
  contentType: string,
  bucket = env.s3UploadsBucket,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  logger.debug("File uploaded to S3", { bucket, key });
  return key;
}

/**
 * Get a file from S3.
 */
export async function getFile(
  key: string,
  bucket = env.s3UploadsBucket,
): Promise<{ body: ReadableStream | null; contentType: string | undefined }> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return {
    body: result.Body as ReadableStream | null,
    contentType: result.ContentType,
  };
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(
  key: string,
  bucket = env.s3UploadsBucket,
): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  logger.debug("File deleted from S3", { bucket, key });
}

/**
 * Generate a pre-signed URL for upload (PUT) or download (GET).
 */
export async function getPresignedUrl(
  key: string,
  operation: "get" | "put",
  expiresInSeconds = 3600,
  bucket = env.s3UploadsBucket,
): Promise<string> {
  const command =
    operation === "put"
      ? new PutObjectCommand({ Bucket: bucket, Key: key })
      : new GetObjectCommand({ Bucket: bucket, Key: key });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

/**
 * Check if S3 bucket is reachable (for health checks).
 */
export async function checkStorageHealth(
  bucket = env.s3UploadsBucket,
): Promise<boolean> {
  if (!bucket) return false;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

export { s3 as s3Client };
