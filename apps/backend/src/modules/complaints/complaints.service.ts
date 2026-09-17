import type { CreateComplaintRequest } from '@reto/shared';
import { complaintsModel, type ComplaintsFilter } from './complaints.model';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate } from '@/lib/common/response';

/**
 * complaints.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-09. Sección 9 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const complaintsService = {
  getMany: async (filter: ComplaintsFilter & { page?: number; pageSize?: number }) => {
    const pagination = normalizePagination(filter);
    const { items, total } = await complaintsModel.getMany(filter, pagination.skip, pagination.take);
    return paginate(items, total, pagination);
  },

  getById: async (complaintId: number) => {
    const complaint = await complaintsModel.getById(complaintId);
    if (!complaint) throw ApiError.notFound('La denuncia no existe');
    return complaint;
  },

  create: async (data: CreateComplaintRequest) => {
    return complaintsModel.create(data);
  },

  setResultado: async (complaintId: number, resultado: 'PROCEDE' | 'NO_PROCEDE' | 'REMISION_OTRO_PROCESO') => {
    await complaintsService.getById(complaintId);
    return complaintsModel.setResultado(complaintId, resultado);
  },

  generateCase: async (complaintId: number) => {
    const complaint = await complaintsService.getById(complaintId);
    if (complaint.resultado !== 'PROCEDE') {
      throw ApiError.conflict('Solo se puede generar un caso cuando el resultado es PROCEDE');
    }
    if (complaint.case) {
      throw ApiError.conflict('Esta denuncia ya tiene un caso generado');
    }
    if (!complaint.institutionId) {
      throw ApiError.validation('La denuncia no tiene una institución asociada; no se puede generar un caso');
    }
    const createdCase = await complaintsModel.generateCase(complaintId, complaint.institutionId);
    return { case: createdCase };
  },
};
