import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

console.log('====================================================');
console.log('   DIAGNÓSTICO DE CONEXIÓN A POSTGRESQL (RADAR EBR)  ');
console.log('====================================================');
console.log('URL de Conexión:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@'));

const startTime = Date.now();

try {
  // Import dinámico para asegurar que DATABASE_URL ya esté en process.env
  const { default: prisma } = await import('@reto/db');

  console.log('\n[1/4] Comprobando conexión directa y latencia...');
  const ping: Array<{ db_name: string; db_user: string; version: string; server_time: Date }> = await prisma.$queryRaw`
    SELECT 
      current_database() as db_name, 
      current_user as db_user, 
      version() as version,
      NOW() as server_time
  `;
  const pingLatency = Date.now() - startTime;
  console.log(`✅ Conexión establecida en ${pingLatency}ms`);
  console.log(`   Base de Datos : ${ping[0].db_name}`);
  console.log(`   Usuario       : ${ping[0].db_user}`);
  console.log(`   Hora Servidor : ${ping[0].server_time.toISOString()}`);
  console.log(`   Versión       : ${ping[0].version.split(',')[0]}`);

  console.log('\n[2/4] Verificando tablas del esquema público...');
  const tables: Array<{ table_name: string }> = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log(`✅ ${tables.length} tablas activas en PostgreSQL:`);
  console.log('   ' + tables.map(t => t.table_name).join(', '));

  console.log('\n[3/4] Comprobando entidades del sistema (Conteos)...');
  const [
    rolesCount,
    usersCount,
    personsCount,
    institutionsCount,
    formsCount,
    h1Count,
    h2Count,
    evaluationsCount,
    lapchAlertsCount,
    riskRulesCount
  ] = await Promise.all([
    prisma.role.count().catch(() => -1),
    prisma.user.count().catch(() => -1),
    prisma.person.count().catch(() => -1),
    prisma.institution.count().catch(() => -1),
    prisma.formTemplate.count().catch(() => -1),
    prisma.h1.count().catch(() => -1),
    prisma.h2Ask.count().catch(() => -1),
    prisma.evaluation.count().catch(() => -1),
    prisma.lapchAlert.count().catch(() => -1),
    prisma.riskFrequencyRule.count().catch(() => -1),
  ]);

  console.log(`   • Roles: ${rolesCount}`);
  console.log(`   • Personas: ${personsCount}`);
  console.log(`   • Usuarios: ${usersCount}`);
  console.log(`   • Instituciones/Establecimientos: ${institutionsCount}`);
  console.log(`   • Fichas/Formularios: ${formsCount}`);
  console.log(`   • Capítulos BPM (H1): ${h1Count}`);
  console.log(`   • Preguntas BPM (H2Ask): ${h2Count}`);
  console.log(`   • Evaluaciones: ${evaluationsCount}`);
  console.log(`   • Alertas LAPCH: ${lapchAlertsCount}`);
  console.log(`   • Reglas de Riesgo (EBR): ${riskRulesCount}`);

  console.log('\n[4/4] Muestra de datos existentes...');
  const sampleUsers = await prisma.user.findMany({
    take: 4,
    include: {
      person: { select: { name: true, email: true } },
      role: { select: { name: true } }
    }
  });

  console.log('   Usuarios de prueba disponibles:');
  sampleUsers.forEach(u => {
    console.log(`   - ${u.person.name} (${u.person.email}) | Rol: ${u.role?.name ?? 'Sin rol'} | Estado: ${u.status}`);
  });

  await prisma.$disconnect();
  console.log('\n====================================================');
  console.log('🎉 RESULTADO: CONEXIÓN A BASE DE DATOS 100% EXITOSA');
  console.log('====================================================');
} catch (error) {
  console.error('\n❌ ERROR AL CONECTAR CON LA BASE DE DATOS:');
  console.error(error);
  process.exit(1);
}
