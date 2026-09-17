
export  {prisma as default}  from './client.js'
// Se exporta como VALOR (no solo `export type`) porque el namespace `Prisma`
// también trae clases runtime que necesita el backend (ej. errorHandler.ts
// usa `Prisma.PrismaClientKnownRequestError` para distinguir errores P2002/P2025).
export { Prisma } from './generated/prisma/client.js'
export type * from './generated/prisma/client.js'
export * from './generated/prisma/enums.js'