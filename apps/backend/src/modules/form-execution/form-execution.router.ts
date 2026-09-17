import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { formExecutionController } from './form-execution.controller';
import { StartEvaluationSchema, FormAnswersSchema, IdParamSchema } from './form-execution.schemas';

/**
 * form-execution.router.ts
 * ---------------------------------------------------------------------------
 * Base paths: /form-templates, /evaluations/:id/{start,answers,finish}
 * (montado bajo /api/v1). Sección 11 de API_CONTRACTS.md (RF-12, RF-13).
 * Todas las acciones de ejecución son exclusivas del técnico asignado
 * (validado en form-execution.service.ts, ya que requiere comparar contra
 * `evaluation.technicianId`).
 * ---------------------------------------------------------------------------
 */
export const formExecutionRouter = Router();

formExecutionRouter
  .use(validateJwt)
  .get('/form-templates', formExecutionController.getTemplates)
  .get('/form-templates/:id/tree', validateReq(IdParamSchema, 'params'), formExecutionController.getTemplateTree)
  .post(
    '/evaluations/:id/start',
    validateRole('TECNICO_EVALUADOR'),
    validateReq(IdParamSchema, 'params'),
    validateReq(StartEvaluationSchema, 'body'),
    formExecutionController.start,
  )
  .patch(
    '/evaluations/:id/answers',
    validateRole('TECNICO_EVALUADOR'),
    validateReq(IdParamSchema, 'params'),
    validateReq(FormAnswersSchema, 'body'),
    formExecutionController.saveAnswers,
  )
  .post(
    '/evaluations/:id/finish',
    validateRole('TECNICO_EVALUADOR'),
    validateReq(IdParamSchema, 'params'),
    formExecutionController.finish,
  );
