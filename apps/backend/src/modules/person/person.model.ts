import prisma from '@reto/db';



export const personModel = {
    getWithPasswordByEmail: async (email: string) => {
        return await prisma.person.findUnique({
            where: { email },
            include: { user: true },
        });
    }
}