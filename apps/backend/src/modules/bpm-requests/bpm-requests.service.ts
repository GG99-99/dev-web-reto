import type { Prisma } from '@reto/db';
import type { CreateBpmRequestRequest, SubmitBpmRequestResponse, UpdateBpmRequestRequest } from '@reto/shared';
import { bpmRequestsModel, type BpmRequestsFilter } from './bpm-requests.model';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';
import prisma from '@reto/db';

/**
 * bpm-requests.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-05. Sección 5 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

function buildOrderBy(pagination: NormalizedPagination): Prisma.BpmRequestOrderByWithRelationInput {
  const allowed = new Set(['bpmRequestId', 'status', 'createdAt', 'sentAt']);
  if (pagination.sortBy && allowed.has(pagination.sortBy)) {
    return { [pagination.sortBy]: pagination.sortDir } as Prisma.BpmRequestOrderByWithRelationInput;
  }
  return { createdAt: 'desc' };
}

export const bpmRequestsService = {
  getMany: async (filter: BpmRequestsFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) => {
    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await bpmRequestsModel.getMany(filter, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (bpmRequestId: number) => {
    const bpmRequest = await bpmRequestsModel.getById(bpmRequestId);
    if (!bpmRequest) throw ApiError.notFound('La solicitud BPM no existe');
    return bpmRequest;
  },

  /** Lanza si el `requester` no es ni el autor ni COORDINADOR/ADMIN. */
  assertAccess: (bpmRequest: { createdById: number }, requester: { userId: number; role: string | null }) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (bpmRequest.createdById !== requester.userId) {
      throw ApiError.forbidden('No tienes acceso a esta solicitud');
    }
  },

  assertIsAuthorAndDraft: (bpmRequest: { createdById: number; status: string }, requester: { userId: number }) => {
    if (bpmRequest.createdById !== requester.userId) {
      throw ApiError.forbidden('Solo el autor puede modificar esta solicitud');
    }
    if (bpmRequest.status !== 'BORRADOR') {
      throw ApiError.conflict('La solicitud ya no está en borrador');
    }
  },

  create: async (createdById: number, data: CreateBpmRequestRequest) => {
    return bpmRequestsModel.create(data, createdById);
  },

  update: async (bpmRequestId: number, requesterId: number, data: UpdateBpmRequestRequest) => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    bpmRequestsService.assertIsAuthorAndDraft(bpmRequest, { userId: requesterId });
    return bpmRequestsModel.update(bpmRequestId, data);
  },

  addAttachment: async (bpmRequestId: number, requesterId: number, file: Express.Multer.File) => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    if (bpmRequest.createdById !== requesterId) {
      throw ApiError.forbidden('Solo el autor puede adjuntar documentación');
    }

    return prisma.attachment.create({
      data: {
        category: 'DOCUMENTACION_OBLIGATORIA',
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        uploadedById: requesterId,
        bpmRequestId,
      },
    });
  },

  submit: async (bpmRequestId: number, requesterId: number): Promise<SubmitBpmRequestResponse> => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    bpmRequestsService.assertIsAuthorAndDraft(bpmRequest, { userId: requesterId });

    return bpmRequestsModel.submit(bpmRequestId, bpmRequest.institutionId);
  },
};
