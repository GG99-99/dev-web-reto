import type { ApiResponse, DocumentVerification } from '@reto/shared';
/** `GET /public/documents/verify` — no session. Confirms an official-report QR. */
declare function verify(token: string): Promise<ApiResponse<DocumentVerification>>;
export declare const documentsService: {
    verify: typeof verify;
};
export {};
