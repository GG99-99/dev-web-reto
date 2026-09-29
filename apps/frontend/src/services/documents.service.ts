import { httpClient } from './httpClient';
import type { ApiResponse, DocumentVerification } from '@reto/shared';

/** `GET /public/documents/verify` — no session. Confirms an official-report QR. */
async function verify(token: string): Promise<ApiResponse<DocumentVerification>> {
  const { data } = await httpClient.get<ApiResponse<DocumentVerification>>('/public/documents/verify', {
    params: { token },
  });
  return data;
}

export const documentsService = { verify };
