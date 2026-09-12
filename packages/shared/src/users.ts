/**
 * users.ts
 * ---------------------------------------------------------------------------
 * Tipos del módulo de Usuarios y Roles (RF-02 / RNF-02).
 * Endpoints: /users, /users/:id, /users/register, /users/:id/status, /roles
 * ---------------------------------------------------------------------------
 */
import type { Prisma } from '@reto/db';

/**
 * Usuario con su `Person` y `Role` incluidos. Es el tipo de respuesta
 * estándar de los endpoints de detalle/listado de usuarios.
 */
export type UserWithPerson = Prisma.UserGetPayload<{
  include: { person: true; role: true };
}>;

/**
 * Body de `POST /users/register` (autorregistro de Admin Empresa o Usuario
 * Delegado; el registro queda en estado `PENDIENTE_VALIDACION`).
 *
 * @example
 * ```ts
 * const body: RegisterUserRequest = {
 *   person: { name: 'Ana Pérez', cedula: '001-1234567-8', phone: '8091234567', email: 'ana@empresa.com' },
 *   password: 'S3guro!23',
 *   roleId: 3, // USUARIO_DELEGADO
 *   cartaAutorizacionFileId: 42,
 * };
 * ```
 */

export interface RegisterUserRequest {
  /** Subconjunto de campos de `Person` necesarios para el alta. */
  person: Pick<Prisma.PersonCreateInput, 'name' | 'cedula' | 'phone' | 'email'>;
  password: string;
  /** Debe corresponder a `ADMIN_EMPRESA` o `USUARIO_DELEGADO`. */
  roleId: number;
  /** Id del `Attachment` (categoría `CARTA_AUTORIZACION`) subido previamente vía `/attachments`. */
  cartaAutorizacionFileId?: number;
}

/**
 * Respuesta de `POST /users/register`.
 * El usuario creado tendrá `status = 'PENDIENTE_VALIDACION'` hasta que un
 * ADMIN lo apruebe con `PATCH /users/:id/status`.
 */
export type RegisterUserResponse = UserWithPerson;

/**
 * Body de `PATCH /users/:id/status`, usado por un ADMIN para aprobar o
 * rechazar un autorregistro pendiente.
 *
 * @example
 * ```ts
 * const body: UpdateUserStatusRequest = { status: 'RECHAZADO', motivoRechazo: 'Documento ilegible' };
 * ```
 */
export interface UpdateUserStatusRequest {
  status: 'APROBADO' | 'RECHAZADO';
  /** Requerido en la práctica cuando `status === 'RECHAZADO'`. */
  motivoRechazo?: string;
}

/** Catálogo de roles del sistema (`GET /roles`, solo ADMIN). */
export type Role = Prisma.RoleGetPayload<{}>;
