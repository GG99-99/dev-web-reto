import type { Prisma } from '@reto/db';
import { personModel } from './person.model';
import { ApiError } from '@/lib/common/ApiError';

export const personService = {
  getById: async (personId: number) => {
    const person = await personModel.getById(personId);
    if (!person) throw ApiError.notFound('Person not found');
    return person;
  },

  getByEmail: async (email: string) => {
    return personModel.getByEmail(email);
  },

  getWithUserByEmail: async (email: string) => {
    return personModel.getWithUserByEmail(email);
  },

  getWithUserByCedula: async (cedula: string) => {
    return personModel.getWithUserByCedula(cedula);
  },

  /** `usuario` on login can be email or national ID; we try both. */
  getWithUserByUsuario: async (usuario: string) => {
    const byEmail = await personModel.getWithUserByEmail(usuario);
    if (byEmail) return byEmail;
    return personModel.getWithUserByCedula(usuario);
  },

  /** Verifies that cedula and email are not already registered. */
  assertIsNew: async (cedula: string, email: string) => {
    const [byCedula, byEmail] = await Promise.all([
      personModel.getByCedula(cedula),
      personModel.getByEmail(email),
    ]);
    if (byCedula) throw ApiError.conflict('A person with that national ID is already registered');
    if (byEmail) throw ApiError.conflict('A person with that email is already registered');
  },

  create: async (data: Prisma.PersonCreateInput, tx?: Prisma.TransactionClient) => {
    return personModel.create(data, tx);
  },

  update: async (personId: number, data: Prisma.PersonUpdateInput) => {
    await personService.getById(personId);
    return personModel.update(personId, data);
  },
};
