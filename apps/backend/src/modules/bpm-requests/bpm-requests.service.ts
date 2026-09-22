import type { Prisma } from '@reto/db';
import type { CreateBpmRequestRequest, SubmitBpmRequestResponse, UpdateBpmRequestRequest } from '@reto/shared';
import { bpmRequestsModel, type BpmRequestsFilter } from './bpm-requests.model';
import { dashboardModel } from '../dashboard/dashboard.model';
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
    if (!bpmRequest) throw ApiError.notFound('BPM request not found');
    return bpmRequest;
  },

  /** Throws if the requester is not the author, institution owner/rep, or COORDINADOR/ADMIN. */
  assertAccess: async (
    bpmRequest: { createdById: number; institutionId?: number },
    requester: { userId: number; role: string | null; personId?: number },
  ) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (bpmRequest.createdById === requester.userId) return;
    if (requester.personId && bpmRequest.institutionId) {
      const owned = await dashboardModel.getOwnedInstitutionIds(requester.personId);
      if (owned.includes(bpmRequest.institutionId)) return;
    }
    throw ApiError.forbidden('You do not have access to this request');
  },

  assertIsAuthorAndDraft: (bpmRequest: { createdById: number; status: string }, requester: { userId: number }) => {
    if (bpmRequest.createdById !== requester.userId) {
      throw ApiError.forbidden('Only the author can modify this request');
    }
    if (bpmRequest.status !== 'BORRADOR') {
      throw ApiError.conflict('This request is no longer in draft status');
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
      throw ApiError.forbidden('Only the author can attach documentation to this request');
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
