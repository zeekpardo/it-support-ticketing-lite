import { getPresignedUrl } from '../lib/storage.js';

/**
 * Replace all s3:{key} image sources in HTML with presigned URLs.
 */
export async function resolveS3ImageUrls(html, expiresIn = 3600) {
  const s3Pattern = /src="s3:([^"]+)"/g;
  const matches = [...html.matchAll(s3Pattern)];
  if (matches.length === 0) return html;

  const replacements = await Promise.all(
    matches.map(async (match) => {
      try {
        const url = await getPresignedUrl(match[1], expiresIn);
        return { original: match[0], replacement: `src="${url}"` };
      } catch {
        return { original: match[0], replacement: 'src=""' };
      }
    })
  );

  let resolved = html;
  for (const { original, replacement } of replacements) {
    resolved = resolved.replace(original, replacement);
  }
  return resolved;
}

/**
 * Resolve a single s3:{key} file URL to a presigned URL.
 * Returns the original attachment object with the URL resolved.
 */
export async function resolveAttachmentUrl(attachment) {
  if (attachment.fileUrl?.startsWith('s3:')) {
    try {
      return { ...attachment, fileUrl: await getPresignedUrl(attachment.fileUrl.slice(3)) };
    } catch { return attachment; }
  }
  return attachment;
}
