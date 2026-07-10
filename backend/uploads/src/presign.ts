// backend/uploads/src/presign.ts
//
// S3 presigned-URL generation for test/question image uploads. Keys are always
// prefixed with the caller's tenant id, so a presigned URL can never write
// outside its tenant's namespace (plan/01-architecture.md §Security).

import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Signer abstraction so the handler can be tested without real AWS creds. */
export type PresignFn = (key: string, contentType: string) => Promise<string>;

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED.has(contentType);
}

/** Build a tenant-prefixed, collision-free object key for an upload. */
export function buildKey(tenantId: number, contentType: string): string {
  const ext = EXT[contentType] ?? 'bin';
  return `tenants/${tenantId}/uploads/${randomUUID()}.${ext}`;
}

/** Default signer: PUT presign against the configured bucket, 5-minute expiry. */
export const defaultPresign: PresignFn = async (key, contentType) => {
  const bucket = process.env.UPLOADS_BUCKET;
  if (!bucket) throw new Error('UPLOADS_BUCKET is not set');
  const client = new S3Client({});
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(client, command, { expiresIn: 300 });
};
