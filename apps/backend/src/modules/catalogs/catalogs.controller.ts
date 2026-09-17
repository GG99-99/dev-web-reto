import type { Request, Response } from 'express';
import type { Category, Food, HealthArea, SubCategory } from '@reto/shared';
import { catalogsService } from './catalogs.service';
import { ok } from '@/lib/common/response';

export const catalogsController = {
  getProvinces: async (_req: Request, res: Response) => {
    const data = await catalogsService.getProvinces();
    return res.status(200).json(ok(data));
  },

  getMunicipalities: async (req: Request, res: Response) => {
    const { provinceId } = req.validated!.query;
    const data = await catalogsService.getMunicipalities(provinceId);
    return res.status(200).json(ok(data));
  },

  getHealthAreas: async (_req: Request, res: Response) => {
    const data: HealthArea[] = await catalogsService.getHealthAreas();
    return res.status(200).json(ok(data));
  },

  getCategories: async (_req: Request, res: Response) => {
    const data: Category[] = await catalogsService.getCategories();
    return res.status(200).json(ok(data));
  },

  getSubCategories: async (req: Request, res: Response) => {
    const { id } = req.validated!.params;
    const data: SubCategory[] = await catalogsService.getSubCategories(id);
    return res.status(200).json(ok(data));
  },

  getFoods: async (req: Request, res: Response) => {
    const { categoryId } = req.validated!.query;
    const data: Food[] = await catalogsService.getFoods(categoryId);
    return res.status(200).json(ok(data));
  },
};
