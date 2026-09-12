import {personModel} from './person.model';


export const personService = {
    getByEmail: async (email: string) => {
        return await personModel.getWithPasswordByEmail(email);
    }
}