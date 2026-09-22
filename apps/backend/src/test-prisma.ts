import prisma from '@reto/db';
async function run() {
  try {
    const inst = await prisma.institution.create({
      data: {
        name: 'Test',
        streetName: 'Test',
        streetNum: '42-B',
        phoneNumber: '123',
        email: 'test@test.com',
        rnc: '123',
        propietary: { connect: { propietaryId: 1 } },
        municipality: { connect: { municipalityId: 1 } }
      }
    });
    console.log('Success:', inst);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
