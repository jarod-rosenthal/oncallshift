import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const s3 = new S3Client({ region: config.aws.region });

export async function uploadFile(
  key: string,
  body: Buffer | string,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: config.aws.s3.uploadsBucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3.send(command);
  logger.debug("File uploaded to S3", { key });
}

export async function getFile(key: string): Promise<Buffer | undefined> {
  const command = new GetObjectCommand({
    Bucket: config.aws.s3.uploadsBucket,
    Key: key,
  });

  const result = await s3.send(command);
  if (!result.Body) return undefined;

  const chunks: Uint8Array[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.aws.s3.uploadsBucket,
    Key: key,
  });

  await s3.send(command);
  logger.debug("File deleted from S3", { key });
}
