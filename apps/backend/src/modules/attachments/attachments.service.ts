import fs from 'node:fs/promises';
import path from 'node:path';
import type { Attachment, UploadAttachmentRequest } from '@reto/shared';
import { attachmentsModel } from './attachments.model';
import { ApiError } from '@/lib/common/ApiError';
import { UPLOADS_DIR } from '@/lib/upload/upload';

/**
 * attachments.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio del endpoint genérico de adjuntos. Sección 17 de
 * API_CONTRACTS.md.
 *
 * NOTA de alcance: el contrato dice "Con acceso a la entidad dueña" para
 * GET/DELETE, pero eso requiere que cada módulo dueño (bpm-requests,
 * evidences, reports, users) exponga una forma de verificar pertenencia.
 * Como esos módulos aún no existen (ver documentos/backend.txt), por ahora
 * se aplica una regla conservadora: el propio usuario que subió el archivo,
 * o ADMIN. TODO: una vez existan esos módulos, delegarles la validación de
 * acceso fina (ej. "soy el dueño del BpmRequest al que pertenece este
 * adjunto").
 * ---------------------------------------------------------------------------
 */

export const attachmentsService = {
  create: async (
    file: Express.Multer.File,
    category: UploadAttachmentRequest['category'],
    uploadedById: number,
  ): Promise<Attachment> => {
    const fileUrl = `/uploads/${file.filename}`;
    return attachmentsModel.create({
      category,
      fileName: file.originalname,
      fileUrl,
      mimeType: file.mimetype,
      uploadedById,
    });
  },

  getById: async (attachmentId: number, requester: { userId: number; role: string | null }) => {
    const attachment = await attachmentsModel.getById(attachmentId);
    if (!attachment) throw ApiError.notFound('El adjunto no existe');

    if (requester.role !== 'ADMIN' && attachment.uploadedById !== requester.userId) {
      throw ApiError.forbidden('No tienes acceso a este adjunto');
    }
    return attachment;
  },

  remove: async (attachmentId: number, requester: { userId: number; role: string | null }) => {
    const attachment = await attachmentsModel.getById(attachmentId);
    if (!attachment) throw ApiError.notFound('El adjunto no existe');

    if (requester.role !== 'ADMIN' && attachment.uploadedById !== requester.userId) {
      throw ApiError.forbidden('Solo el dueño del recurso o un ADMIN pueden eliminarlo');
    }

    await attachmentsModel.delete(attachmentId);

    // best-effort: si falla el borrado físico no rompemos la respuesta,
    // el registro en BD ya se eliminó (evita adjuntos "fantasma" en la API).
    const filePath = path.join(UPLOADS_DIR, path.basename(attachment.fileUrl));
    await fs.unlink(filePath).catch(() => undefined);

    return attachment;
  },
};
