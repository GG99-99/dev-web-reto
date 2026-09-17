import { rolesModel } from './roles.model';

export const rolesService = {
  getMany: async () => rolesModel.getMany(),
};
