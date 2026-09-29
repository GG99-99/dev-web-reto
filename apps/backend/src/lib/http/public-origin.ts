import type { Request } from 'express';

/** Origin encoded in official-report QR codes. Prefers PUBLIC_APP_URL, then the browser Origin. */
export function publicAppOrigin(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  const origin = req.get('origin');
  if (origin && origin !== 'null') return origin.replace(/\/$/, '');
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost').split(',')[0].trim();
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}
