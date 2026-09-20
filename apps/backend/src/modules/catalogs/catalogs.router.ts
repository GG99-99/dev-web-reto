import { Router, type Router as ExpressRouter } from 'express';
import { validateJwt, validateReq } from '#backend/middlewares';
import { catalogsController } from './catalogs.controller';
import { MunicipalitiesQuerySchema, FoodsQuerySchema, CategoryIdParamSchema } from './catalogs.schemas';

/**
 * catalogs.router.ts
 * ---------------------------------------------------------------------------
 * Base path: /catalogs (montado bajo /api/v1). Secciones 3 y 17 de
 * API_CONTRACTS.md. Todos los endpoints requieren solo estar autenticado.
 * ---------------------------------------------------------------------------
 */
export const catalogsRouter: ExpressRouter = Router();

catalogsRouter
  .use('/catalogs', validateJwt)
  .get('/catalogs/provinces', catalogsController.getProvinces)
  .get('/catalogs/municipalities', validateReq(MunicipalitiesQuerySchema, 'query'), catalogsController.getMunicipalities)
  .get('/catalogs/health-areas', catalogsController.getHealthAreas)
  .get('/catalogs/categories', catalogsController.getCategories)
  .get(
    '/catalogs/categories/:id/subcategories',
    validateReq(CategoryIdParamSchema, 'params'),
    catalogsController.getSubCategories,
  )
  .get('/catalogs/foods', validateReq(FoodsQuerySchema, 'query'), catalogsController.getFoods);
