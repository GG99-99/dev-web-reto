/**
 * users.service.ts
 * ---------------------------------------------------------------------------
 * Servicio axios tipado del módulo de Usuarios y Roles (RF-02 / RNF-02).
 * Ver API_CONTRACTS.md, sección 2.
 * ---------------------------------------------------------------------------
 */
import { httpClient } from './httpClient';
import type {
  ApiResponse,
  Attachment,
  PaginatedResponse,
  PaginationQuery,
  UserWithPerson,
  RegisterUserRequest,
  RegisterUserResponse,
  UpdateUserStatusRequest,
  Role,
} from '@reto/shared';

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
async function list(query?: ListUsersQuery): Promise<ApiResponse<PaginatedResponse<UserWithPerson>>> {
  const { data } = await httpClient.get<ApiResponse<PaginatedResponse<UserWithPerson>>>('/users', {
    params: query,
  });
  return data;
}

/** `GET /users/:id` — ADMIN o el propio usuario. */
async function getById(id: number): Promise<ApiResponse<UserWithPerson>> {
  const { data } = await httpClient.get<ApiResponse<UserWithPerson>>(`/users/${id}`);
  return data;
}

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
async function register(body: RegisterUserRequest): Promise<ApiResponse<RegisterUserResponse>> {
  const { data } = await httpClient.post<ApiResponse<RegisterUserResponse>>('/users/register', body);
  return data;
}

/** Public upload used by self-registration before `POST /users/register`. */
async function uploadAuthorizationLetter(file: File): Promise<ApiResponse<Attachment>> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await httpClient.post<ApiResponse<Attachment>>(
    '/users/register/authorization-letter',
    form,
  );
  return data;
}

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
async function update(id: number, body: UpdateUserRequest): Promise<ApiResponse<UserWithPerson>> {
  const { data } = await httpClient.patch<ApiResponse<UserWithPerson>>(`/users/${id}`, body);
  return data;
}

/**
 * `PATCH /users/:id/status` — ADMIN. Aprueba o rechaza un autorregistro pendiente.
 *
 * @example
 * ```ts
 * await usersService.updateStatus(userId, { status: 'RECHAZADO', motivoRechazo: 'Documento ilegible' });
 * ```
 */
async function updateStatus(
  id: number,
  body: UpdateUserStatusRequest,
): Promise<ApiResponse<UserWithPerson>> {
  const { data } = await httpClient.patch<ApiResponse<UserWithPerson>>(`/users/${id}/status`, body);
  return data;
}

/** `DELETE /users/:id` — ADMIN. Desactiva el usuario (soft delete vía `isActive`). */
async function deactivate(id: number): Promise<ApiResponse<{ id: number }>> {
  const { data } = await httpClient.delete<ApiResponse<{ id: number }>>(`/users/${id}`);
  return data;
}

/** `GET /roles` — ADMIN. Catálogo de roles del sistema. */
async function listRoles(): Promise<ApiResponse<Role[]>> {
  const { data } = await httpClient.get<ApiResponse<Role[]>>('/roles');
  return data;
}

export const usersService = {
  list,
  getById,
  register,
  uploadAuthorizationLetter,
  update,
  updateStatus,
  deactivate,
  listRoles,
};
