/**
 * seed.utils.ts
 * ---------------------------------------------------------------------------
 * Utilidades compartidas por todos los seeders de esta carpeta.
 *
 * Todos los seeders son IDEMPOTENTES: se pueden correr N veces sin duplicar
 * datos. Como la mayoría de las tablas usan `@id @default(autoincrement())`
 * y no tienen un `@unique` natural, cada seeder busca primero por su "clave
 * natural" (rnc, cédula, nombre, numeroAlerta...) antes de crear.
 * ---------------------------------------------------------------------------
 */

/** Log uniforme de cada seeder. */
export function logSeed(entity: string, created: number, skipped: number) {
  console.log(`[seed] ${entity.padEnd(24)} creados: ${created}  ya existentes: ${skipped}`);
}

/** Error explícito cuando falta una dependencia que debía sembrarse antes. */
export function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(
      `[seed] Falta una dependencia: ${what}. Revisa el orden de los seeders en lib/seeders/index.ts`,
    );
  }
  return value;
}

/** Fecha relativa a hoy, en días (negativo = pasado). Útil para data de prueba. */
export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}
