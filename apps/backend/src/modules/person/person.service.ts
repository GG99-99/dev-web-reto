import type { Prisma } from '@reto/db';
import { personModel } from './person.model';
import { ApiError } from '@/lib/common/ApiError';

export const personService = {
  getById: async (personId: number) => {
    const person = await personModel.getById(personId);
    if (!person) throw ApiError.notFound('La persona no existe');
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

  /** `usuario` del login puede ser email o cédula; probamos ambos formatos. */
  getWithUserByUsuario: async (usuario: string) => {
    const byEmail = await personModel.getWithUserByEmail(usuario);
    if (byEmail) return byEmail;
    return personModel.getWithUserByCedula(usuario);
  },

  /** Verifica que cédula y email no estén registrados aún (RF-02: alta de usuario). */
  assertIsNew: async (cedula: string, email: string) => {
    const [byCedula, byEmail] = await Promise.all([
      personModel.getByCedula(cedula),
      personModel.getByEmail(email),
    ]);
    if (byCedula) throw ApiError.conflict('Ya existe una persona registrada con esa cédula');
    if (byEmail) throw ApiError.conflict('Ya existe una persona registrada con ese email');
  },

  create: async (data: Prisma.PersonCreateInput, tx?: Prisma.TransactionClient) => {
    return personModel.create(data, tx);
  },

  update: async (personId: number, data: Prisma.PersonUpdateInput) => {
    await personService.getById(personId);
    return personModel.update(personId, data);
  },
};
