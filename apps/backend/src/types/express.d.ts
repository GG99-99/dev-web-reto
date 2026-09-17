// types/express.d.ts
import type { UserRole } from '@reto/shared';
import type { AccessTokenPayload } from '@/lib/auth/jwt';

declare global {
  namespace Express {
    interface Request {
      /** Payload decodificado del accessToken (ver middlewares/validateJwt.ts) */
      user?: AccessTokenPayload;
      /** Body/query/params ya validados y parseados por zod (ver middlewares/validateReq.ts) */
      validated?: {
        body?: any;
        params?: any;
        query?: any;
      };
    }
  }
}

export {}; // hace que TS trate este archivo como módulo
