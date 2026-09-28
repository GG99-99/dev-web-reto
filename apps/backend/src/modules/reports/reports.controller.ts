import type { Request, Response } from 'express';
import type { FormAnswers } from '@reto/shared';
import { reportsService } from './reports.service';
import { evaluationsService } from '../evaluations/evaluations.service';
import { ok } from '@/lib/common/response';
import { ApiError } from '@/lib/common/ApiError';

/**
 * reports.controller.ts
 * ---------------------------------------------------------------------------
 * Sección 14 de API_CONTRACTS.md (RF-16, RF-17, RF-18). El acceso "con
 * acceso" se resuelve delegando a evaluationsService.assertAccess (mismo
 * criterio: COORDINADOR/ADMIN, o el técnico dueño de la evaluación).
 * ---------------------------------------------------------------------------
 */

async function assertAccessByEvaluationId(evaluationId: number, req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  const evaluation = await evaluationsService.getById(evaluationId);
  await evaluationsService.assertAccess(evaluation, { userId: req.user.userId, role: req.user.role, personId: req.user.personId });
  return evaluation;
}

/** Submit, correct, and resend belong to the assigned field technician. Reading a report does not grant those actions. */
function assertAssignedTechnician(evaluation: { technicianId: number }, req: Request) {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role === 'ADMIN') return;
  if (req.user.role !== 'TECNICO_EVALUADOR' || evaluation.technicianId !== req.user.userId) {
    throw ApiError.forbidden('Only the assigned technician can modify this report');
  }
}

export const reportsController = {
  getByEvaluation: async (req: Request, res: Response) => {
    const { id } = req.validated!.params; // evaluationId
    await assertAccessByEvaluationId(id, req);
    const data = await reportsService.getByEvaluationId(id);
    return res.status(200).json(ok(data));
  },

  preview: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params; // evaluationId
    const evaluation = await assertAccessByEvaluationId(id, req);
    const answers = req.validated!.body?.answers as FormAnswers | undefined;
    const data = await reportsService.preview(evaluation, answers, {
      userId: req.user.userId,
      role: req.user.role ?? '',
    });
    return res.status(200).json(ok(data));
  },

  submit: async (req: Request, res: Response) => {
    const { id } = req.validated!.params; // reportId
    const report = await reportsService.getById(id);
    const evaluation = await assertAccessByEvaluationId(report.evaluationId, req);
    assertAssignedTechnician(evaluation, req);
    const data = await reportsService.submit(id);
    return res.status(200).json(ok(data));
  },

  review: async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { id } = req.validated!.params; // reportId
    const body = req.validated!.body;
    const data = await reportsService.review(id, req.user.userId, body);
    return res.status(200).json(ok(data));
  },

  getReviews: async (req: Request, res: Response) => {
    const { id } = req.validated!.params; // reportId
    const report = await reportsService.getById(id);
    await assertAccessByEvaluationId(report.evaluationId, req);
    const data = await reportsService.getReviews(id);
    return res.status(200).json(ok(data));
  },

  correct: async (req: Request, res: Response) => {
    const { id } = req.validated!.params; // reportId
    const report = await reportsService.getById(id);
    const evaluation = await assertAccessByEvaluationId(report.evaluationId, req);
    assertAssignedTechnician(evaluation, req);
    const body = req.validated!.body;
    const data = await reportsService.correct(id, body);
    return res.status(200).json(ok(data));
  },

  resend: async (req: Request, res: Response) => {
    const { id } = req.validated!.params; // reportId
    const report = await reportsService.getById(id);
    const evaluation = await assertAccessByEvaluationId(report.evaluationId, req);
    assertAssignedTechnician(evaluation, req);
    const data = await reportsService.resend(id);
    return res.status(200).json(ok(data));
  },
};
