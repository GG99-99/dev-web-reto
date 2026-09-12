/**
 * catalogs.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Catálogos y Adjuntos genéricos (sección 17).
 * Endpoints: /catalogs/categories, /catalogs/categories/:id/subcategories,
 * /catalogs/foods, /catalogs/health-areas, /attachments, /attachments/:id
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/** Categoría de alimento (`GET /catalogs/categories`). */
export type Category = Prisma.CategoryGetPayload<{}>;

/**
 * Subcategoría de alimento, con su nivel de riesgo asociado (Matriz de
 * Riesgo de Alimentos). Respuesta de `GET /catalogs/categories/:id/subcategories`.
 */
export type SubCategory = Prisma.SubCategoryGetPayload<{}>;

/** Alimento (`GET /catalogs/foods?categoryId=`). */
export type Food = Prisma.FoodGetPayload<{}>;

/** Área de salud (`GET /catalogs/health-areas`). */
export type HealthArea = Prisma.HealthAreaGetPayload<{}>;

/**
 * Body de `POST /attachments` (subida genérica, `multipart/form-data`).
 * Retorna un `attachmentId` que luego se asocia a otra entidad (ej.
 * `RegisterUserRequest.cartaAutorizacionFileId`, `CreateEvidenceRequest`, etc.).
 *
 * @example
 * ```ts
 * const form = new FormData();
 * form.append('file', pdfFile);
 * form.append('category', 'CARTA_AUTORIZACION' satisfies UploadAttachmentRequest['category']);
 * const { data } = await fetch('/api/v1/attachments', { method: 'POST', body: form }).then(r => r.json());
 * console.log(data.attachmentId);
 * ```
 */
export interface UploadAttachmentRequest {
  file: File;
  category:
    | 'CARTA_AUTORIZACION'
    | 'DOCUMENTACION_OBLIGATORIA'
    | 'EVIDENCIA_FOTO'
    | 'EVIDENCIA_VIDEO'
    | 'EVIDENCIA_DOCUMENTO'
    | 'INFORME_ADJUNTO'
    | 'INFORME_OFICIAL_PDF'
    | 'OTRO';
}

/** Modelo plano de `Attachment`, generado por Prisma. */
export type Attachment = Prisma.AttachmentGetPayload<{}>;
