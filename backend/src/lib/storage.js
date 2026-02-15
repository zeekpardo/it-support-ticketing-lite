import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const endpoint = process.env.BUCKET_ENDPOINT || process.env.ENDPOINT;
  const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID;
  const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY;
  const region = process.env.BUCKET_REGION || process.env.REGION || 'auto';

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  s3Client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  return s3Client;
}

const BUCKET_NAME = process.env.BUCKET_NAME || process.env.BUCKET || process.env.RAILWAY_BUCKET_NAME || '';

/**
 * Check if S3 storage is configured
 */
export function isStorageConfigured() {
  return !!(process.env.BUCKET_ENDPOINT && process.env.BUCKET_ACCESS_KEY_ID && process.env.BUCKET_SECRET_ACCESS_KEY && BUCKET_NAME);
}

/**
 * Upload a file to the S3 bucket
 *
 * @param {Buffer} buffer - File content
 * @param {string} key - S3 object key (path)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} The S3 key of the uploaded file
 */
export async function uploadFile(buffer, key, contentType) {
  const client = getS3Client();
  if (!client) throw new Error('S3 storage not configured');

  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return key;
}

/**
 * Generate a presigned URL for reading a file
 *
 * @param {string} key - S3 object key
 * @param {number} [expiresIn=3600] - URL expiry in seconds (default 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const client = getS3Client();
  if (!client) throw new Error('S3 storage not configured');

  return getSignedUrl(client, new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }), { expiresIn });
}

/**
 * Delete a file from the S3 bucket
 *
 * @param {string} key - S3 object key
 */
export async function deleteFile(key) {
  const client = getS3Client();
  if (!client) return;

  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));
}

/**
 * Generate a unique S3 key for a ticket attachment
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} filename - Original filename
 * @returns {string} S3 key
 */
export function generateAttachmentKey(ticketId, filename) {
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
  return `attachments/${ticketId}/${hash}${ext}`;
}
