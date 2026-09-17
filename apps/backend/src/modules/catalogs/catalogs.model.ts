import prisma from '@reto/db';

/**
 * catalogs.model.ts
 * ---------------------------------------------------------------------------
 * Catálogos de solo lectura. Secciones 3 (provincias/municipios) y 17
 * (categorías/subcategorías/alimentos/áreas de salud) de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */
export const catalogsModel = {
  getProvinces: async () => {
    return prisma.province.findMany({ orderBy: { name: 'asc' } });
  },

  getMunicipalities: async (provinceId?: number) => {
    return prisma.municipality.findMany({
      where: { ...(provinceId && { provinceId }) },
      orderBy: { name: 'asc' },
    });
  },

  getHealthAreas: async () => {
    return prisma.healthArea.findMany({ orderBy: { name: 'asc' } });
  },

  getCategories: async () => {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  },

  getSubCategoriesByCategory: async (categoryId: number) => {
    return prisma.subCategory.findMany({ where: { categoryId }, orderBy: { name: 'asc' } });
  },

  getFoods: async (categoryId?: number) => {
    return prisma.food.findMany({
      where: { ...(categoryId && { categoryId }) },
      orderBy: { name: 'asc' },
    });
  },

  categoryExists: async (categoryId: number) => {
    const category = await prisma.category.findUnique({ where: { categoryId } });
    return category !== null;
  },
};
