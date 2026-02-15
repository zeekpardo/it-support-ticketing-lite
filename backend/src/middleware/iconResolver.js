import { resolveFileUrl } from '../lib/storage.js';

export async function resolveSoftwareIcon(software) {
  if (!software) return software;
  return { ...software, iconUrl: await resolveFileUrl(software.iconUrl) };
}
