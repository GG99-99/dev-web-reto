import type { Prisma } from '@reto/db';
import type {
  RegisterUserRequest,
  RegisterUserResponse,
  UpdateUserStatusRequest,
} from '@reto/shared';
import { usersModel, type UsersFilter } from './users.model';
import { personService } from '../person/person.service';
import { ApiError } from '@/lib/common/ApiError';
import { hashPassword } from '@/lib/auth/password';
import { normalizePagination, paginate, type NormalizedPagination } from '@/lib/common/response';

/**
 * users.service.ts
 * ---------------------------------------------------------------------------
 * Lógica de negocio de RF-02 / RNF-02. Sección 2 de API_CONTRACTS.md.
 * ---------------------------------------------------------------------------
 */

function buildOrderBy(pagination: NormalizedPagination): Prisma.UserOrderByWithRelationInput {
  if (!pagination.sortBy) return { createdAt: pagination.sortDir };
  // Solo permitimos ordenar por columnas propias de User para evitar
  // inyectar `orderBy` arbitrario sobre relaciones.
  const allowed = new Set(['userId', 'status', 'isActive', 'createdAt']);
  if (!allowed.has(pagination.sortBy)) return { createdAt: pagination.sortDir };
  return { [pagination.sortBy]: pagination.sortDir } as Prisma.UserOrderByWithRelationInput;
}

export const usersService = {
  getMany: async (filter: UsersFilter & { page?: number; pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) => {
    const pagination = normalizePagination(filter);
    const orderBy = buildOrderBy(pagination);

    const { items, total } = await usersModel.getMany(
      { status: filter.status, roleId: filter.roleId },
      pagination.skip,
      pagination.take,
      orderBy,
    );

    return paginate(items, total, pagination);
  },

  getById: async (userId: number) => {
    const user = await usersModel.getById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  register: async (data: RegisterUserRequest): Promise<RegisterUserResponse> => {
    await personService.assertIsNew(data.person.cedula, data.person.email);

    const passwordHash = await hashPassword(data.password);

    const user = await usersModel.register(
      data.person as Prisma.PersonCreateInput,
      passwordHash,
      data.roleId,
      data.cartaAutorizacionFileId,
    );

    return user as unknown as RegisterUserResponse;
  },

  updateStatus: async (userId: number, { status, motivoRechazo }: UpdateUserStatusRequest) => {
    const user = await usersService.getById(userId);

    const updated = await usersModel.updateStatus(userId, status);

    if (status === 'RECHAZADO') {
      await usersModel.createNotification(
        userId,
        'Registration rejected',
        motivoRechazo?.trim() || 'Your registration request was rejected by an administrator.',
      );
    } else {
      await usersModel.createNotification(userId, 'Registration approved', 'Your account has been approved. You can now log in.');
    }

    void user; // solo se usó para validar existencia
    return updated;
  },

  /** Editar datos de `Person` asociados al usuario (PATCH /users/:id). */
  update: async (userId: number, personData: Prisma.PersonUpdateInput) => {
    const user = await usersService.getById(userId);
    return personService.update(user.personId, personData);
  },

  softDelete: async (userId: number) => {
    await usersService.getById(userId);
    return usersModel.softDelete(userId);
  },
};
