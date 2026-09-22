import { catalogsModel } from './catalogs.model';
import { ApiError } from '@/lib/common/ApiError';

export const catalogsService = {
  getProvinces: async () => catalogsModel.getProvinces(),

  getMunicipalities: async (provinceId?: number) => catalogsModel.getMunicipalities(provinceId),

  getHealthAreas: async () => catalogsModel.getHealthAreas(),

  getCategories: async () => catalogsModel.getCategories(),

  getSubCategories: async (categoryId: number) => {
    const exists = await catalogsModel.categoryExists(categoryId);
    if (!exists) throw ApiError.notFound('Category not found');
    return catalogsModel.getSubCategoriesByCategory(categoryId);
  },

  getFoods: async (categoryId?: number) => catalogsModel.getFoods(categoryId),
};
