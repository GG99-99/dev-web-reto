import type { ApiResponse, Category, SubCategory, Food, HealthArea, UploadAttachmentRequest, Attachment } from '@reto/shared';
/** `GET /catalogs/categories` — Autenticado. Categorías de alimento. */
declare function listCategories(): Promise<ApiResponse<Category[]>>;
/**
 * `GET /catalogs/categories/:id/subcategories` — Autenticado.
 * Subcategorías + nivel de riesgo (Matriz_Riesgo_Alimentos).
 */
declare function listSubcategories(categoryId: number): Promise<ApiResponse<SubCategory[]>>;
/** `GET /catalogs/foods?categoryId=` — Autenticado. */
declare function listFoods(categoryId: number): Promise<ApiResponse<Food[]>>;
/** `GET /catalogs/health-areas` — Autenticado. */
declare function listHealthAreas(): Promise<ApiResponse<HealthArea[]>>;
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
declare function uploadAttachment(body: UploadAttachmentRequest): Promise<ApiResponse<Attachment>>;
/** `GET /attachments/:id` — Con acceso a la entidad dueña. Descargar/ver metadato. */
declare function getAttachment(id: number): Promise<ApiResponse<Attachment>>;
/** `DELETE /attachments/:id` — Dueño del recurso, ADMIN. */
declare function deleteAttachment(id: number): Promise<ApiResponse<{
    id: number;
}>>;
export declare const catalogsService: {
    listCategories: typeof listCategories;
    listSubcategories: typeof listSubcategories;
    listFoods: typeof listFoods;
    listHealthAreas: typeof listHealthAreas;
    uploadAttachment: typeof uploadAttachment;
    getAttachment: typeof getAttachment;
    deleteAttachment: typeof deleteAttachment;
};
export {};
