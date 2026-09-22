import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateEvidenceRequest } from '@reto/shared';
import { evidencesModel } from './evidences.model';
import { evaluationsService } from '../evaluations/evaluations.service';
import { ApiError } from '@/lib/common/ApiError';
import { UPLOADS_DIR } from '@/lib/upload/upload';

/**
 * evidences.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-15. Sección 13 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const evidencesService = {
  getMany: async (evaluationId: number, requester: { userId: number; role: string | null }) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    evaluationsService.assertAccess(evaluation, requester);
    return evidencesModel.getManyByEvaluation(evaluationId);
  },

  /**
   * @remarks del contrato: "Solo el TECNICO_EVALUADOR asignado a la
   * evaluación puede subir evidencias, y solo antes de finalizarla."
   */
  create: async (
    evaluationId: number,
    requesterId: number,
    file: Express.Multer.File,
    data: Omit<CreateEvidenceRequest, 'file'>,
  ) => {
    const evaluation = await evaluationsService.getById(evaluationId);
    if (evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician can upload evidence for this evaluation');
    }
    if (evaluation.status === 'FINALIZADA' || evaluation.status === 'CANCELADA') {
      throw ApiError.conflict('Evidence cannot be uploaded to a completed or cancelled evaluation');
    }

    return evidencesModel.create({
      evaluationId,
      type: data.type,
      fileUrl: `/uploads/${file.filename}`,
      comment: data.comment,
      latitude: data.latitude,
      longitude: data.longitude,
      h1AskId: data.h1AskId,
      h2AskId: data.h2AskId,
      h3AskId: data.h3AskId,
      h4AskId: data.h4AskId,
    });
  },

  remove: async (evidenceId: number, requesterId: number, role: string | null) => {
    const evidence = await evidencesModel.getById(evidenceId);
    if (!evidence) throw ApiError.notFound('Evidence not found');

    const evaluation = await evaluationsService.getById(evidence.evaluationId);
    if (role !== 'ADMIN' && evaluation.technicianId !== requesterId) {
      throw ApiError.forbidden('Only the assigned technician or an ADMIN can delete this evidence');
    }

    await evidencesModel.delete(evidenceId);
    await fs.unlink(path.join(UPLOADS_DIR, path.basename(evidence.fileUrl))).catch(() => undefined);
    return evidence;
  },
};
