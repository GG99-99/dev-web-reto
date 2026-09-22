import type { CaseDetail, CloseCaseResponse, CreateInstitutionalCaseRequest } from '@reto/shared';
import type { Prisma } from '@reto/db';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { casesModel, type CasesFilter } from './cases.model';
import { institutionsService } from '../institutions/institutions.service';
import { ApiError } from '@/lib/common/ApiError';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';
import { UPLOADS_DIR } from '@/lib/upload/upload';

/**
 * cases.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-06 (casos) y RF-19 (cierre de expediente).
 * Sección 6 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

function buildOrderBy(pagination: NormalizedPagination): Prisma.CaseOrderByWithRelationInput {
  const allowed = new Set(['caseId', 'status', 'priority', 'openedAt', 'closedAt']);
  if (pagination.sortBy && allowed.has(pagination.sortBy)) {
    return { [pagination.sortBy]: pagination.sortDir } as Prisma.CaseOrderByWithRelationInput;
  }
  return { openedAt: 'desc' };
}

/**
 * NOTA: `CreateInstitutionalCaseRequest.motivo` no tiene una columna
 * equivalente en el modelo `Case` del schema de Prisma (Case no tiene
 * `motivo`/`reason`, solo `resultadoFinal` para el cierre). El contrato
 * indica que ese motivo "se usa además para crear el Evaluation.reason
 * inicial del caso", pero programar una evaluación requiere technicianId +
 * scheduledDate que este endpoint no recibe. Por ahora el motivo se acepta y
 * valida pero NO se persiste. TODO: agregar columna `Case.motivoApertura`
 * (o similar) en una migración, o documentar que debe reenviarse al crear
 * la Evaluation vía POST /evaluations.
 */
export const casesService = {
  getMany: async (filter: CasesFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) => {
    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);
    const { items, total } = await casesModel.getMany(filter, pagination.skip, pagination.take, orderBy);
    return paginate(items, total, pagination);
  },

  getById: async (caseId: number): Promise<CaseDetail> => {
    const found = await casesModel.getById(caseId);
    if (!found) throw ApiError.notFound('Case not found');
    return found as unknown as CaseDetail;
  },

  /** COORDINADOR/ADMIN: full access. TECNICO_EVALUADOR: only if they are the assigned technician. */
  assertAccess: (caseDetail: { technicianId: number | null }, requester: { userId: number; role: string | null }) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (requester.role === 'TECNICO_EVALUADOR' && caseDetail.technicianId === requester.userId) return;
    throw ApiError.forbidden('You do not have access to this case');
  },

  create: async (data: CreateInstitutionalCaseRequest) => {
    return casesModel.create({ institutionId: data.institutionId, priority: data.priority });
  },

  updatePriority: async (caseId: number, priority: 'BAJA' | 'MEDIA' | 'ALTA') => {
    await casesService.getById(caseId);
    return casesModel.updatePriority(caseId, priority);
  },

  /**
   * RF-19. Si `emitirInforme` es true, genera un adjunto con el resultado
   * del cierre.
   *
   * ⚠️ STUB: no hay una librería de generación de PDF instalada en el
   * monorepo (ni pdfkit ni puppeteer). Se genera un archivo de TEXTO PLANO
   * con el resumen del cierre y se guarda como Attachment con
   * category=INFORME_OFICIAL_PDF para no bloquear el flujo end-to-end.
   * TODO: agregar `pdfkit` (ligero) o `puppeteer` (HTML->PDF) y reemplazar
   * `renderClosingSummary` por un PDF real.
   */
  close: async (caseId: number, requesterId: number, resultadoFinal: string, emitirInforme: boolean): Promise<CloseCaseResponse> => {
    const existing = await casesService.getById(caseId);
    if (existing.status === 'CERRADO') throw ApiError.conflict('This case is already closed');

    const closed = await casesModel.close(caseId, resultadoFinal);

    let informeOficialUrl: string | undefined;
    if (emitirInforme) {
      const fileName = `closing-report-case-${caseId}.txt`;
      const storedName = `${crypto.randomUUID()}.txt`;
      const content = renderClosingSummary(closed as unknown as CaseDetail, resultadoFinal);
      await fs.writeFile(path.join(UPLOADS_DIR, storedName), content, 'utf-8');

      const attachment = await casesModel.attachOfficialReport(caseId, {
        fileName,
        fileUrl: `/uploads/${storedName}`,
        mimeType: 'text/plain',
        uploadedById: requesterId,
      });
      informeOficialUrl = attachment.fileUrl;
    }

    return { case: closed as unknown as CaseDetail, informeOficialUrl };
  },

  /** GET /cases/:id/close/pdf — COORDINADOR/ADMIN, or ADMIN_EMPRESA who owns that institution. */
  assertCanDownloadOfficialReport: async (caseDetail: { institutionId: number }, requester: { personId: number; role: string | null }) => {
    if (requester.role === 'COORDINADOR' || requester.role === 'ADMIN') return;
    if (requester.role === 'ADMIN_EMPRESA') {
      await institutionsService.assertAccess(requester.personId, requester.role, caseDetail.institutionId);
      return;
    }
    throw ApiError.forbidden('You do not have access to the official report for this case');
  },

  getOfficialReportAttachment: async (caseId: number) => {
    const attachment = await casesModel.getOfficialReportAttachment(caseId);
    if (!attachment) throw ApiError.notFound('This case does not yet have an official report generated');
    return attachment;
  },
};

function renderClosingSummary(caseDetail: CaseDetail, resultadoFinal: string): string {
  return [
    'OFFICIAL CASE CLOSURE REPORT',
    '(automatically generated document — provisional plain text format,',
    ' pending replacement with a real PDF, see TODO in cases.service.ts)',
    '',
    `Case #${caseDetail.caseId}`,
    `Institution: ${caseDetail.institution.name} (RNC ${caseDetail.institution.rnc})`,
    `Origin: ${caseDetail.origin}`,
    `Priority: ${caseDetail.priority}`,
    `Opened at: ${caseDetail.openedAt.toISOString()}`,
    `Closed at: ${new Date().toISOString()}`,
    '',
    'Final result:',
    resultadoFinal,
  ].join('\n');
}
