import { ENV } from '../../config/env';

// V54: several endpoints return media as a path already prefixed with
// /api/v1 (e.g. product photos, vendor videos — see GET /products,
// GET /videos/:videoId in the backend), meant to be appended to the
// server's origin. ENV.API_BASE_URL already ends in /api/v1 itself, so
// naively concatenating the two would double it up
// (".../api/v1/api/v1/...") and every image/video would 404. This strips
// that suffix once, here, so every screen doesn't need to know about it.
const ORIGIN = ENV.API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export function resolveMediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}
