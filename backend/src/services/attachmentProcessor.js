import { prisma } from '../lib/auth.js';
import { uploadFile, generateAttachmentKey } from '../lib/storage.js';

/**
 * Download attachments from Resend and upload to S3 bucket.
 * Creates TicketAttachment records for each file.
 * Returns a Map of contentId → s3Key for inline images (used for CID replacement in HTML).
 */
export async function downloadAndStoreAttachments(emailId, ticketId, uploadedById) {
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
