import jwt from 'jsonwebtoken';
import type { UserRole } from '@reto/shared';

/**
 * jwt.ts
 * ---------------------------------------------------------------------------
 * Firma y verificación de accessToken / refreshToken (RF-01, RNF-02).
 * El accessToken viaja en el header `Authorization: Bearer <token>` (0.1 de
 * API_CONTRACTS.md), no en cookie.
 * ---------------------------------------------------------------------------
 */

export interface AccessTokenPayload {
  userId: number;
  personId: number;
  roleId: number | null;
  role: UserRole | null;
}

export interface RefreshTokenPayload {
  userId: number;
}

export interface TempTokenPayload {
  userId: number;
  purpose: '2fa';
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dev-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const TEMP_EXPIRES_IN = process.env.JWT_TEMP_EXPIRES_IN || '5m';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function signTempToken(payload: TempTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: TEMP_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as unknown as RefreshTokenPayload;
}

export function verifyTempToken(token: string): TempTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as unknown as TempTokenPayload;
  if (decoded.purpose !== '2fa') {
    throw new Error('Token temporal inválido');
  }
  return decoded;
}
