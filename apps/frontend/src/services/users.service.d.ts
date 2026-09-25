import type { ApiResponse, Attachment, PaginatedResponse, PaginationQuery, UserWithPerson, RegisterUserRequest, RegisterUserResponse, UpdateUserStatusRequest, Role } from '@reto/shared';
/** Filtros de `GET /users`, combinados con {@link PaginationQuery}. */
export interface ListUsersQuery extends PaginationQuery {
    status?: string;
    roleId?: number;
}
/**
 * `GET /users` — ADMIN, COORDINADOR (para el directorio de evaluadores).
 *
 * @example
 * ```ts
 * const res = await usersService.list({ status: 'APROBADO', page: 1, pageSize: 20 });
 * ```
 */
declare function list(query?: ListUsersQuery): Promise<ApiResponse<PaginatedResponse<UserWithPerson>>>;
/** `GET /users/:id` — ADMIN o el propio usuario. */
declare function getById(id: number): Promise<ApiResponse<UserWithPerson>>;
/**
 * `POST /users/register` — Público. Autorregistro de Admin Empresa / Usuario
 * Delegado; el usuario queda con `status = 'PENDIENTE_VALIDACION'`.
 *
 * @example
 * ```ts
 * const res = await usersService.register({
 *   person: { name: 'Ana Pérez', cedula: '001-1234567-8', phone: '8091234567', email: 'ana@empresa.com' },
 *   password: 'S3guro!23',
 *   roleId: 3,
 * });
 * ```
 */
declare function register(body: RegisterUserRequest): Promise<ApiResponse<RegisterUserResponse>>;
/** Public upload used by self-registration before `POST /users/register`. */
declare function uploadAuthorizationLetter(file: File): Promise<ApiResponse<Attachment>>;
/**
 * Body de `PATCH /users/:id` (editar datos de la `Person` asociada).
 * No está tipado explícitamente en el contrato original; se define aquí
 * como parcial de los campos editables de persona.
 */
export interface UpdateUserRequest {
    name?: string;
    phone?: string;
    email?: string;
}
/** `PATCH /users/:id` — ADMIN o el propio usuario. */
declare function update(id: number, body: UpdateUserRequest): Promise<ApiResponse<UserWithPerson>>;
/**
 * `PATCH /users/:id/status` — ADMIN. Aprueba o rechaza un autorregistro pendiente.
 *
 * @example
 * ```ts
 * await usersService.updateStatus(userId, { status: 'RECHAZADO', motivoRechazo: 'Documento ilegible' });
 * ```
 */
declare function updateStatus(id: number, body: UpdateUserStatusRequest): Promise<ApiResponse<UserWithPerson>>;
/** `DELETE /users/:id` — ADMIN. Desactiva el usuario (soft delete vía `isActive`). */
declare function deactivate(id: number): Promise<ApiResponse<{
    id: number;
}>>;
/** `GET /roles` — ADMIN. Catálogo de roles del sistema. */
declare function listRoles(): Promise<ApiResponse<Role[]>>;
export declare const usersService: {
    list: typeof list;
    getById: typeof getById;
    register: typeof register;
    uploadAuthorizationLetter: typeof uploadAuthorizationLetter;
    update: typeof update;
    updateStatus: typeof updateStatus;
    deactivate: typeof deactivate;
    listRoles: typeof listRoles;
};
export {};
