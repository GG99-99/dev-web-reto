import prisma, { type AttachmentCategory } from '@reto/db';

/**
 * attachments.model.ts
 * ---------------------------------------------------------------------------
 * Acceso a datos de `Attachment` (tabla genérica de adjuntos). Sección 17 de
 * API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

export interface CreateAttachmentData {
  category: AttachmentCategory;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedById: number;
}

export const attachmentsModel = {
  create: async (data: CreateAttachmentData) => {
    return prisma.attachment.create({ data });
  },

  getById: async (attachmentId: number) => {
    return prisma.attachment.findUnique({ where: { attachmentId } });
  },

  delete: async (attachmentId: number) => {
    return prisma.attachment.delete({ where: { attachmentId } });
  },
};
