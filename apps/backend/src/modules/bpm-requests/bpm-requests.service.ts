import type { Prisma } from '@reto/db';
import type { CreateBpmRequestRequest, SubmitBpmRequestResponse, UpdateBpmRequestRequest } from '@reto/shared';
import { bpmRequestsModel, type BpmRequestsFilter } from './bpm-requests.model';
import { institutionsService } from '../institutions/institutions.service';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';
import prisma from '@reto/db';
import { reconcileBpmRows, withLifecycleStatus } from '../lifecycle/request-lifecycle';

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
    const reconciled = await reconcileBpmRows(items);
    return paginate(reconciled.map((item) => withLifecycleStatus(item)), total, pagination);
  },

  getById: async (bpmRequestId: number) => {
    const bpmRequest = await bpmRequestsModel.getById(bpmRequestId);
    if (!bpmRequest) throw ApiError.notFound('BPM request not found');
    const [reconciled] = await reconcileBpmRows([bpmRequest]);
    return withLifecycleStatus(reconciled ?? bpmRequest);
  },

  /** Throws if the requester cannot see this request. Company users must own the establishment. */
  assertAccess: async (
    bpmRequest: { createdById: number; institutionId?: number },
    requester: { userId: number; role: string | null; personId?: number },
  ) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (requester.role === 'ADMIN_EMPRESA' || requester.role === 'USUARIO_DELEGADO') {
      if (!requester.personId || !bpmRequest.institutionId) {
        throw ApiError.forbidden('You do not have access to this request');
      }
      await institutionsService.assertAccess(requester.personId, requester.role, bpmRequest.institutionId);
      return;
    }
    if (bpmRequest.createdById === requester.userId) return;
    throw ApiError.forbidden('You do not have access to this request');
  },

  assertIsAuthorAndDraft: (bpmRequest: { createdById: number; status: string }, requester: { userId: number; role: string | null }) => {
    if (requester.role !== 'ADMIN' && bpmRequest.createdById !== requester.userId) {
      throw ApiError.forbidden('Only the author can modify this request');
    }
    if (bpmRequest.status !== 'BORRADOR') {
      throw ApiError.conflict('This request is no longer in draft status');
    }
  },

  create: async (
    requester: { userId: number; role: string | null; personId?: number },
    data: CreateBpmRequestRequest,
  ) => {
    if (requester.role === 'ADMIN_EMPRESA' || requester.role === 'USUARIO_DELEGADO') {
      if (!requester.personId) throw ApiError.forbidden('You do not have access to this establishment');
      await institutionsService.assertAccess(requester.personId, requester.role, data.institutionId);
    }
    return bpmRequestsModel.create(data, requester.userId);
  },

  update: async (
    bpmRequestId: number,
    requester: { userId: number; role: string | null; personId?: number },
    data: UpdateBpmRequestRequest,
  ) => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    await bpmRequestsService.assertAccess(bpmRequest, requester);
    bpmRequestsService.assertIsAuthorAndDraft(bpmRequest, requester);
    return bpmRequestsModel.update(bpmRequestId, data);
  },

  addAttachment: async (
    bpmRequestId: number,
    requester: { userId: number; role: string | null; personId?: number },
    file: Express.Multer.File,
  ) => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    await bpmRequestsService.assertAccess(bpmRequest, requester);
    if (requester.role !== 'ADMIN' && bpmRequest.createdById !== requester.userId) {
      throw ApiError.forbidden('Only the author can attach documentation to this request');
    }

    return prisma.attachment.create({
      data: {
        category: 'DOCUMENTACION_OBLIGATORIA',
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        uploadedById: requester.userId,
        bpmRequestId,
      },
    });
  },

  submit: async (
    bpmRequestId: number,
    requester: { userId: number; role: string | null; personId?: number },
  ): Promise<SubmitBpmRequestResponse> => {
    const bpmRequest = await bpmRequestsService.getById(bpmRequestId);
    await bpmRequestsService.assertAccess(bpmRequest, requester);
    bpmRequestsService.assertIsAuthorAndDraft(bpmRequest, requester);

    return bpmRequestsModel.submit(bpmRequestId, bpmRequest.institutionId);
  },
};
