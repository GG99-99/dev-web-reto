import multer from 'multer';
import type { RequestHandler } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * upload.ts
 * ---------------------------------------------------------------------------
 * Configuración de multer para `multipart/form-data` (RF-02 carta de
 * autorización, RF-05 documentación obligatoria, RF-15 evidencias, RF-16
 * informe, RF-19 informe oficial PDF — todos vía el endpoint genérico
 * POST /attachments, sección 17 de API_CONTRACTS.md).
 *
 * Almacenamiento: disco local en apps/backend/uploads/ (servido como
 * estático en /uploads, ver app.ts). No hay proveedor cloud (S3/GCS)
 * configurado en el monorepo — ver TODO en documentos/backend.txt si se
 * necesita para producción/despliegue multi-instancia.
 * ---------------------------------------------------------------------------
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// apps/backend/src/lib/upload -> apps/backend/uploads
export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const uploadSingleFile: RequestHandler = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('file');
