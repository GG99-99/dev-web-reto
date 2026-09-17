import { Router } from 'express';
import { validateJwt, validateReq, validateRole } from '#backend/middlewares';
import { usersController } from './users.controller';
import { GetUsersQuerySchema, RegisterUserSchema, UpdateUserSchema, UpdateUserStatusSchema } from './users.schemas';
import { IdParamSchema } from '@/lib/common/schemas';

/**
 * users.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /users (montado bajo /api/v1). Sección 2 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const usersRouter:Router = Router();

usersRouter
  // Público
  .post('/users/register', validateReq(RegisterUserSchema, 'body'), usersController.register)

  // ADMIN
  .get('/users', validateJwt, validateRole('ADMIN'), validateReq(GetUsersQuerySchema, 'query'), usersController.getMany)
  .patch(
    '/users/:id/status',
    validateJwt,
    validateRole('ADMIN'),
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateUserStatusSchema, 'body'),
    usersController.updateStatus,
  )
  .delete('/users/:id', validateJwt, validateRole('ADMIN'), validateReq(IdParamSchema, 'params'), usersController.remove)

  // ADMIN o propio usuario (validado dentro del controller)
  .get('/users/:id', validateJwt, validateReq(IdParamSchema, 'params'), usersController.getOne)
  .patch(
    '/users/:id',
    validateJwt,
    validateReq(IdParamSchema, 'params'),
    validateReq(UpdateUserSchema, 'body'),
    usersController.update,
  );
