import crypto from 'node:crypto';
import prisma from '@reto/db';

/**
 * auth.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de autenticación: User, PasswordResetToken, TwoFactorAuth.
 * Sección 1 (RF-01) de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const authModel = {
  getUserWithRoleByUserId: async (userId: number) => {
    return prisma.user.findUnique({
      where: { userId },
      include: { person: true, role: true },
    });
  },

  /** Igual que arriba pero sin el hash de password, para devolverlo en respuestas HTTP. */
  getUserWithRoleByUserIdSafe: async (userId: number) => {
    return prisma.user.findUnique({
      where: { userId },
      include: { person: true, role: true },
      omit: { password: true },
    });
  },

  updatePassword: async (userId: number, passwordHash: string) => {
    return prisma.user.update({ where: { userId }, data: { password: passwordHash } });
  },

  /*******************
  |   PASSWORD RESET  |
   *******************/
  createPasswordResetToken: async (userId: number, expiresInMs: number) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMs);
    const record = await prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
    return record;
  },

  getValidPasswordResetToken: async (token: string) => {
    return prisma.passwordResetToken.findFirst({
      where: { token, used: false, expiresAt: { gt: new Date() } },
    });
  },

  markPasswordResetTokenUsed: async (tokenId: number) => {
    return prisma.passwordResetToken.update({ where: { tokenId }, data: { used: true } });
  },

  /*********
  |   2FA   |
   *********/
  getTwoFactor: async (userId: number) => {
    return prisma.twoFactorAuth.findUnique({ where: { userId } });
  },

  upsertTwoFactor: async (userId: number, secret: string, enabled: boolean) => {
    return prisma.twoFactorAuth.upsert({
      where: { userId },
      create: { userId, secret, enabled },
      update: { secret, enabled },
    });
  },
};
