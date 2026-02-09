import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { logger } from "../utils/logger.js";

const client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType?: string,
): Promise<void> {
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ...(contentType && { ContentType: contentType }),
  };

  await client.send(new PutObjectCommand(params));
  logger.debug("S3 file uploaded", { bucket, key });
}

export async function getFile(
  bucket: string,
  key: string,
): Promise<ReadableStream | undefined> {
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return result.Body?.transformToWebStream();
}

export async function deleteFile(
  bucket: string,
  key: string,
): Promise<void> {
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
  logger.debug("S3 file deleted", { bucket, key });
}

export { client as s3Client };
