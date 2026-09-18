import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * index.ts — ENTRY POINT del seed (pnpm seed)
 * ---------------------------------------------------------------------------
 * Este archivo SOLO hace dos cosas: cargar el .env y luego importar
 * DINÁMICAMENTE (`await import(...)`) todo lo que dependa de `@reto/db`.
 *
 * ⚠️ POR QUÉ IMPORTA: `packages/db/src/client.ts` lee
 * `process.env.DATABASE_URL` en el momento en que ese módulo se evalúa (ahí
 * mismo construye el `PrismaClient`/`PrismaPg`). En ESM, los imports
 * ESTÁTICOS de un archivo se resuelven y ejecutan ANTES que el cuerpo de ese
 * archivo — así que si aquí arriba hubiera un
 * `import { seedAll } from './seed-all.js'` estático, Node evaluaría
 * `seed-all.ts` (y, en cadena, cada *.seeder.ts y `@reto/db`) ANTES de que
 * la línea `dotenv.config(...)` de abajo llegara a ejecutarse.
 *
 * Eso es exactamente lo que pasaba antes de este fix: `DATABASE_URL` llegaba
 * `undefined` a `PrismaPg`, el driver `pg` caía a sus valores por defecto
 * (host `localhost`, puerto `5432`) en vez de leer el `5433` real del
 * contenedor docker-pg, y la conexión fallaba con `ECONNREFUSED` aunque
 * Postgres SÍ estuviera corriendo.
 *
 * La solución es la misma que ya usa apps/backend/src/index.ts para `app.js`:
 * usar `import()` dinámico, que solo se ejecuta cuando esta línea del código
 * corre en tiempo de ejecución — es decir, DESPUÉS de `dotenv.config()`.
 * ---------------------------------------------------------------------------
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 5 niveles arriba: seeders -> lib -> src -> backend -> apps -> raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const { seedAll } = await import('./seed-all.js');
const { default: prisma } = await import('@reto/db');

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
