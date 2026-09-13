/**
 * catalogs.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Catálogos y Adjuntos genéricos.
 * Ver API_CONTRACTS.md, sección 17.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  Category,
  SubCategory,
  Food,
  HealthArea,
  UploadAttachmentRequest,
  Attachment,
} from '@reto/shared';

/** `GET /catalogs/categories` — Autenticado. Categorías de alimento. */
async function listCategories(): Promise<ApiResponse<Category[]>> {
  const { data } = await httpClient.get<ApiResponse<Category[]>>('/catalogs/categories');
  return data;
}

/**
 * `GET /catalogs/categories/:id/subcategories` — Autenticado.
 * Subcategorías + nivel de riesgo (Matriz_Riesgo_Alimentos).
 */
async function listSubcategories(categoryId: number): Promise<ApiResponse<SubCategory[]>> {
  const { data } = await httpClient.get<ApiResponse<SubCategory[]>>(
    `/catalogs/categories/${categoryId}/subcategories`,
  );
  return data;
}

/** `GET /catalogs/foods?categoryId=` — Autenticado. */
async function listFoods(categoryId: number): Promise<ApiResponse<Food[]>> {
  const { data } = await httpClient.get<ApiResponse<Food[]>>('/catalogs/foods', {
    params: { categoryId },
  });
  return data;
}

/** `GET /catalogs/health-areas` — Autenticado. */
async function listHealthAreas(): Promise<ApiResponse<HealthArea[]>> {
  const { data } = await httpClient.get<ApiResponse<HealthArea[]>>('/catalogs/health-areas');
  return data;
}

/**
 * `POST /attachments` — Autenticado. Subida genérica (`multipart/form-data`);
 * retorna el `Attachment` (incluye `attachmentId`) para asociar luego a otra entidad.
 *
 * @example
 * ```ts
 * const res = await catalogsService.uploadAttachment({
 *   file: pdfFile,
 *   category: 'CARTA_AUTORIZACION',
 * });
 * if (res.valid) console.log(res.data.attachmentId);
 * ```
 */
async function uploadAttachment(body: UploadAttachmentRequest): Promise<ApiResponse<Attachment>> {
  const form = new FormData();
  form.append('file', body.file);
  form.append('category', body.category);
  const { data } = await httpClient.post<ApiResponse<Attachment>>('/attachments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** `GET /attachments/:id` — Con acceso a la entidad dueña. Descargar/ver metadato. */
async function getAttachment(id: number): Promise<ApiResponse<Attachment>> {
  const { data } = await httpClient.get<ApiResponse<Attachment>>(`/attachments/${id}`);
  return data;
}

/** `DELETE /attachments/:id` — Dueño del recurso, ADMIN. */
async function deleteAttachment(id: number): Promise<ApiResponse<{ id: number }>> {
  const { data } = await httpClient.delete<ApiResponse<{ id: number }>>(`/attachments/${id}`);
  return data;
}

export const catalogsService = {
  listCategories,
  listSubcategories,
  listFoods,
  listHealthAreas,
  uploadAttachment,
  getAttachment,
  deleteAttachment,
};
