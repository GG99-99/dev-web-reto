import crypto from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * Signed QR seals for official reports.
 * The token is an HMAC over a short payload. Verification recomputes the
 * content digest from the stored record, so a copied QR only confirms the
 * copy that this system still holds.
 */

const require = createRequire(import.meta.url);

interface QrSymbol {
  modules: { size: number; get(row: number, col: number): number | boolean };
}

const qrCore = require('qrcode/lib/core/qrcode') as {
  create(text: string, options?: { errorCorrectionLevel?: string }): QrSymbol;
};

const qrcode = require('qrcode') as {
  toDataURL(text: string, options?: { errorCorrectionLevel?: string; margin?: number; width?: number }): Promise<string>;
};

export type SealKind = 'evaluation' | 'case';

export interface SealClaims {
  kind: SealKind;
  id: number;
  version: number;
  digest: string;
}

export interface EvaluationDigestInput {
  evaluationId: number;
  reportId: number;
  version: number;
  status: string;
  resumenEjecutivo: string;
  hallazgos: string;
  noConformidades: string;
  recomendaciones: string;
  nivelRiesgo: string;
  porcentajeCumplimiento: number | null;
  establishmentName: string;
  rnc: string;
}

export interface CaseDigestInput {
  caseId: number;
  resultadoFinal: string;
  establishmentName: string;
  rnc: string;
}

function sealSecret(): string {
  return process.env.DOCUMENT_SEAL_SECRET
    || process.env.JWT_SECRET
    || process.env.JWT_ACCESS_SECRET
    || 'dev-document-seal';
}

function digestOf(parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('\u001f')).digest('hex').slice(0, 16);
}

function percent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '';
  return value.toFixed(4);
}

export function evaluationReference(evaluationId: number): string {
  return `ACTA-2026-EBR-${String(evaluationId).padStart(4, '0')}`;
}

export function caseReference(caseId: number): string {
  return `CASE-${String(caseId).padStart(4, '0')}`;
}

export function evaluationDigest(input: EvaluationDigestInput): string {
  return digestOf([
    'evaluation',
    String(input.evaluationId),
    String(input.reportId),
    String(input.version),
    input.status,
    input.resumenEjecutivo,
    input.hallazgos,
    input.noConformidades,
    input.recomendaciones,
    input.nivelRiesgo,
    percent(input.porcentajeCumplimiento),
    input.establishmentName,
    input.rnc,
  ]);
}

export function caseDigest(input: CaseDigestInput): string {
  return digestOf([
    'case',
    String(input.caseId),
    input.resultadoFinal,
    input.establishmentName,
    input.rnc,
  ]);
}

export function signSeal(claims: SealClaims): string {
  const payload = Buffer.from(JSON.stringify({
    k: claims.kind === 'evaluation' ? 'e' : 'c',
    id: claims.id,
    v: claims.version,
    d: claims.digest,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sealSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSeal(token: string): SealClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', sealSecret()).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const body = parsed as { k?: unknown; id?: unknown; v?: unknown; d?: unknown };
  if (body.k !== 'e' && body.k !== 'c') return null;
  if (typeof body.id !== 'number' || !Number.isInteger(body.id) || body.id <= 0) return null;
  if (typeof body.v !== 'number' || !Number.isInteger(body.v) || body.v <= 0) return null;
  if (typeof body.d !== 'string' || !/^[a-f0-9]{16}$/.test(body.d)) return null;
  return {
    kind: body.k === 'e' ? 'evaluation' : 'case',
    id: body.id,
    version: body.v,
    digest: body.d,
  };
}

export function verificationUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/?verify=${encodeURIComponent(token)}`;
}

export function qrModules(text: string): boolean[][] {
  const symbol = qrCore.create(text, { errorCorrectionLevel: 'M' });
  const size = symbol.modules.size;
  const rows: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col += 1) {
      line.push(Boolean(symbol.modules.get(row, col)));
    }
    rows.push(line);
  }
  return rows;
}

export function qrDataUrl(text: string): Promise<string> {
  return qrcode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 280 });
}
