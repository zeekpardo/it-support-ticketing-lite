import { prisma } from '../lib/auth.js';
import { uploadFile, generateAttachmentKey, isStorageConfigured } from '../lib/storage.js';

/**
 * Download attachments from Resend and upload to S3 bucket.
 * Creates TicketAttachment records for each file.
 * Returns a Map of contentId → s3Key for inline images (used for CID replacement in HTML).
 * Optional commentId links attachments to a specific comment (for email replies).
 */
export async function downloadAndStoreAttachments(emailId, ticketId, uploadedById, commentId = null) {
  const apiKey = process.env.RESEND_API_KEY;
  const cidToS3Map = new Map();
  if (!apiKey) return cidToS3Map;

  try {
    // Fetch attachment metadata with download URLs from Resend
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}/attachments`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.warn('[InboundEmail] Failed to fetch attachments:', response.status);
      return cidToS3Map;
    }

    const result = await response.json();
    const attachments = result.data || result || [];

    if (!Array.isArray(attachments) || attachments.length === 0) return cidToS3Map;

    for (const att of attachments) {
      try {
        if (!att.download_url) continue;

        // Download the file from Resend's signed URL
        const fileResponse = await fetch(att.download_url);
        if (!fileResponse.ok) {
          console.warn('[InboundEmail] Failed to download attachment:', att.filename, fileResponse.status);
          continue;
        }

        const buffer = Buffer.from(await fileResponse.arrayBuffer());
        const key = generateAttachmentKey(ticketId, att.filename || 'attachment');

        // Upload to S3 bucket
        await uploadFile(buffer, key, att.content_type || 'application/octet-stream');

        // Determine if this is an inline image (embedded in email body via CID)
        const isInline = att.content_disposition === 'inline' && !!att.content_id;

        // Create database record (store S3 key as fileUrl with s3: prefix)
        await prisma.ticketAttachment.create({
          data: {
            ticketId,
            commentId: commentId || null,
            fileName: att.filename || 'attachment',
            fileSize: att.size || buffer.length,
            fileType: att.content_type || 'application/octet-stream',
            fileUrl: `s3:${key}`,
            isInline,
            contentId: att.content_id || null,
            uploadedById,
          },
        });

        // Build CID→S3 key map for inline images
        if (isInline) {
          const cleanCid = att.content_id.replace(/[<>]/g, '');
          cidToS3Map.set(cleanCid, key);
          console.log('[InboundEmail] Stored inline image:', att.filename, 'cid:', cleanCid);
        } else {
          console.log('[InboundEmail] Stored attachment:', att.filename);
        }
      } catch (err) {
        console.error('[InboundEmail] Failed to store attachment:', att.filename, err.message);
      }
    }
  } catch (err) {
    console.error('[InboundEmail] Attachment processing failed:', err.message);
  }

  return cidToS3Map;
}

/**
 * Extract data: URI images from HTML, upload them to S3, and replace with s3: keys.
 * Handles Outlook iOS and other clients that embed images as base64 data URIs.
 * Returns the modified HTML with s3: keys in place of data: URIs.
 */
export async function extractAndUploadDataUris(html, ticketId, uploadedById) {
  if (!html || !isStorageConfigured()) return html;

  // Match src="data:image/xxx;base64,..." — capture mime type and base64 data
  const dataUriPattern = /src="(data:(image\/[a-zA-Z+]+);base64,([A-Za-z0-9+/=\s]+))"/g;
  let processed = html;
  let match;
  const replacements = [];

  while ((match = dataUriPattern.exec(html)) !== null) {
    const [fullAttr, dataUri, mimeType, base64Data] = match;
    const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'png';
    replacements.push({ fullAttr, dataUri, mimeType, base64Data: base64Data.replace(/\s/g, ''), ext });
  }

  for (const { fullAttr, dataUri, mimeType, base64Data, ext } of replacements) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `inline-image.${ext}`;
      const key = generateAttachmentKey(ticketId, fileName);

      await uploadFile(buffer, key, mimeType);

      await prisma.ticketAttachment.create({
        data: {
          ticketId,
          fileName,
          fileSize: buffer.length,
          fileType: mimeType,
          fileUrl: `s3:${key}`,
          isInline: true,
          uploadedById,
        },
      });

      processed = processed.replace(dataUri, `s3:${key}`);
      console.log('[InboundEmail] Uploaded data URI image to S3:', key);
    } catch (err) {
      console.error('[InboundEmail] Failed to upload data URI image:', err.message);
    }
  }

  return processed;
}
