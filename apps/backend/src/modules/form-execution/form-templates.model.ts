import prisma, { type Prisma } from '@reto/db';
import { chooseApplicableTemplate, type FormCaseContext } from '@reto/shared';

/**
 * form-templates.model.ts
 * ---------------------------------------------------------------------------
 * Sección 11.1 de API_CONTRACTS.md (plantillas/árbol de preguntas, solo
 * lectura para el técnico).
 * ---------------------------------------------------------------------------
 */

export const TREE_INCLUDE = {
  h1s: {
    include: {
      h1Asks: true,
      h2s: {
        include: {
          h2Asks: true,
          h3s: { include: { h3Asks: true, h4s: { include: { h4Asks: true } } } },
        },
      },
    },
  },
} satisfies Prisma.FormTemplateInclude;

export const formTemplatesModel = {
  getMany: async () => {
    return prisma.formTemplate.findMany({ orderBy: { createAt: 'desc' } });
  },

  getActive: async () => {
    return prisma.formTemplate.findFirst({ where: { active: true }, orderBy: { createAt: 'desc' } });
  },

  /**
   * Picks the active template whose appliesTo scope matches the case.
   * A universal template (appliesTo null) matches every case and loses to a
   * more specific active template when both match.
   */
  resolveActiveId: async (context: FormCaseContext) => {
    const templates = await prisma.formTemplate.findMany({
      where: { active: true },
      orderBy: { createAt: 'desc' },
    });
    return chooseApplicableTemplate(templates, context)?.formTemplateId ?? null;
  },

  getTreeById: async (formTemplateId: number) => {
    return prisma.formTemplate.findUnique({ where: { formTemplateId }, include: TREE_INCLUDE });
  },
};
