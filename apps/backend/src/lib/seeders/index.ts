import prisma from '@reto/db';

import { seedRoles } from './roles.seeder';
import { seedRiskRules } from './risk-rules.seeder';
import { seedProvinces } from './provinces.seeder';
import { seedMunicipalities } from './municipalities.seeder';
import { seedHealthAreas } from './health-areas.seeder';
import { seedCategories } from './categories.seeder';
import { seedSubCategories } from './sub-categories.seeder';
import { seedFoods } from './foods.seeder';
import { seedPersons } from './persons.seeder';
import { seedUsers, SEED_PASSWORD } from './users.seeder';
import { seedPropietaries } from './propietaries.seeder';
import { seedInstitutions } from './institutions.seeder';
import { seedRepresents } from './represents.seeder';
import { seedFormTemplates } from './form-templates.seeder';
import { seedBpmRequests } from './bpm-requests.seeder';
import { seedLapchAlerts } from './lapch-alerts.seeder';
import { seedComplaints } from './complaints.seeder';
import { seedCases } from './cases.seeder';
import { seedAssignments } from './assignments.seeder';
import { seedEvaluations } from './evaluations.seeder';
import { seedFormResponses } from './form-responses.seeder';
import { seedEvaluationScores } from './evaluation-scores.seeder';
import { seedEvidences } from './evidences.seeder';
import { seedEvaluationReports } from './evaluation-reports.seeder';
import { seedReportReviews } from './report-reviews.seeder';
import { seedAttachments } from './attachments.seeder';
import { seedNotifications } from './notifications.seeder';
import { seedInstitutionStatus } from './institution-status.seeder';
import { seedSaPermits } from './sa-permits.seeder';

/**
 * index.ts — ORQUESTADOR DE SEEDERS
 * ---------------------------------------------------------------------------
 * Ejecuta todos los seeders de esta carpeta EN ORDEN DE DEPENDENCIA: cada
 * bloque solo puede correr si el anterior ya pobló sus FKs. No cambiar el
 * orden sin revisar las dependencias declaradas en el encabezado de cada
 * seeder.
 *
 * Todos los seeders son IDEMPOTENTES (buscan por clave natural antes de
 * crear), así que este script se puede correr N veces sin duplicar datos.
 *
 * Uso:
 *   pnpm --filter @reto/backend seed
 *
 * Requiere que la base ya tenga el schema aplicado (migraciones de
 * packages/db) y que @reto/db esté compilado (pnpm build:packages).
 * ---------------------------------------------------------------------------
 */

interface SeedStep {
  name: string;
  run: () => Promise<void>;
}

/**
 * ORDEN DE EJECUCIÓN. Agrupado por nivel de dependencia:
 *
 *  1. Catálogos puros      — no dependen de nada
 *  2. Identidad            — personas, usuarios, dueños
 *  3. Empresas             — instituciones y representantes
 *  4. Plantilla de ficha   — árbol h1..h4
 *  5. Orígenes de caso     — solicitudes, alertas, denuncias
 *  6. Casos y asignaciones
 *  7. Evaluaciones y su ejecución
 *  8. Resultados           — scores, evidencias, informes, revisiones
 *  9. Transversales        — adjuntos, notificaciones, permisos
 */
const STEPS: SeedStep[] = [
  // --- 1. catálogos ---
  { name: 'roles', run: seedRoles },
  { name: 'risk-frequency-rules', run: seedRiskRules },
  { name: 'provinces', run: seedProvinces },
  { name: 'municipalities', run: seedMunicipalities },
  { name: 'health-areas', run: seedHealthAreas },
  { name: 'categories', run: seedCategories },
  { name: 'sub-categories', run: seedSubCategories },
  { name: 'foods', run: seedFoods },

  // --- 2. identidad ---
  { name: 'persons', run: seedPersons },
  { name: 'users', run: seedUsers },
  { name: 'propietaries', run: seedPropietaries },

  // --- 3. empresas ---
  { name: 'institutions', run: seedInstitutions },
  { name: 'represents', run: seedRepresents },

  // --- 4. plantilla de ficha ---
  { name: 'form-templates', run: seedFormTemplates },

  // --- 5. orígenes de caso ---
  { name: 'bpm-requests', run: seedBpmRequests },
  { name: 'lapch-alerts', run: seedLapchAlerts },
  { name: 'complaints', run: seedComplaints },

  // --- 6. casos ---
  { name: 'cases', run: seedCases },
  { name: 'assignments', run: seedAssignments },

  // --- 7. evaluaciones ---
  { name: 'evaluations', run: seedEvaluations },
  { name: 'form-responses', run: seedFormResponses },

  // --- 8. resultados ---
  { name: 'evaluation-scores', run: seedEvaluationScores },
  { name: 'evidences', run: seedEvidences },
  { name: 'evaluation-reports', run: seedEvaluationReports },
  { name: 'report-reviews', run: seedReportReviews },

  // --- 9. transversales ---
  { name: 'attachments', run: seedAttachments },
  { name: 'notifications', run: seedNotifications },
  { name: 'institution-status', run: seedInstitutionStatus },
  { name: 'sa-permits', run: seedSaPermits },
];

export async function seedAll() {
  console.log('='.repeat(70));
  console.log('SEED — Sistema EBR/BPM');
  console.log('='.repeat(70));

  const startedAt = Date.now();

  for (const step of STEPS) {
    try {
      await step.run();
    } catch (error) {
      console.error(`\n[seed] ❌ Falló el seeder "${step.name}"`);
      throw error;
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('='.repeat(70));
  console.log(`SEED COMPLETADO en ${seconds}s`);
  console.log(`Contraseña de todos los usuarios de prueba: ${SEED_PASSWORD}`);
  console.log('Usuarios: admin@salud.gob.do (ADMIN) · coordinador@salud.gob.do (COORDINADOR)');
  console.log('          tecnico1@salud.gob.do / tecnico2@salud.gob.do (TECNICO_EVALUADOR)');
  console.log('          admin@lacteosdelnorte.do (ADMIN_EMPRESA) · delegado@lacteosdelnorte.do');
  console.log('='.repeat(70));
}

// Permite ejecutarlo directamente: tsx src/lib/seeders/index.ts
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedAll()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
