import {personService} from '../person/person.service';
import {ApiError} from '@/lib/common/ApiError';

export const authService = {
  login: async (email: string, password: string) => {
    const person = await personService.getByEmail(email);
    if(!person) {
      throw new ApiError('Person not found', 'PERSON_NOT_FOUND');
    }
  }
}