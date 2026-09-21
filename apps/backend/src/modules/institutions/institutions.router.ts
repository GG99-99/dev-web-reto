import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { institutionsController } from './institutions.controller';
import {
  GetInstitutionsQuerySchema,
  CreateInstitutionSchema,
  UpdateInstitutionSchema,
  CreateRepresentSchema,
  UpdateRepresentSchema,
  IdParamSchema,
} from './institutions.schemas';

/**
 * institutions.router.ts
 * ---------------------------------------------------------------------------
 * Base paths: /institutions, /representatives (montados bajo /api/v1).
 * Sección 3 de API_CONTRACTS.md (RF-03).
 * ---------------------------------------------------------------------------
 */
export const institutionsRouter: ExpressRouter = Router();

institutionsRouter
  .use('/institutions', validateJwt)
  .use('/representatives', validateJwt)

  .get(
    '/institutions',
    validateRole('ADMIN', 'COORDINADOR', 'ADMIN_EMPRESA', 'USUARIO_DELEGADO'),
    validateReq(GetInstitutionsQuerySchema, 'query'),
    institutionsController.getMany,
  )
  .post(
    '/institutions',
    validateRole('ADMIN_EMPRESA'),
    validateReq(CreateInstitutionSchema, 'body'),
    institutionsController.create,
  )

  // acceso validado dentro del controller (assertAccess: dueño/representante u rol operativo)
  .get('/institutions/:id', validateReq(IdParamSchema, 'params'), institutionsController.getOne)
  .get('/institutions/:id/history', validateReq(IdParamSchema, 'params'), institutionsController.getHistory)
  .get('/institutions/:id/evaluations', validateReq(IdParamSchema, 'params'), institutionsController.getEvaluations)

  .patch(
    '/institutions/:id',
    validateRole('ADMIN_EMPRESA', 'ADMIN'),
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateInstitutionSchema, 'body'),
    institutionsController.update,
  )

  .post(
    '/institutions/:id/representatives',
    validateRole('ADMIN_EMPRESA'),
    validateReq(IdParamSchema, 'params'),
    validateReq(CreateRepresentSchema, 'body'),
    institutionsController.addRepresentative,
  )

  .patch(
    '/representatives/:id',
    validateRole('ADMIN_EMPRESA'),
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateRepresentSchema, 'body'),
    institutionsController.updateRepresentative,
  )
  .delete(
    '/representatives/:id',
    validateRole('ADMIN_EMPRESA'),
    validateReq(IdParamSchema, 'params'),
    institutionsController.removeRepresentative,
  );
