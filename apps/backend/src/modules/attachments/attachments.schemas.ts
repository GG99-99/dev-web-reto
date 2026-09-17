import { z } from 'zod';

export const UploadAttachmentBodySchema = z.object({
  category: z.enum([
    'CARTA_AUTORIZACION',
    'DOCUMENTACION_OBLIGATORIA',
    'EVIDENCIA_FOTO',
    'EVIDENCIA_VIDEO',
    'EVIDENCIA_DOCUMENTO',
    'INFORME_ADJUNTO',
    'INFORME_OFICIAL_PDF',
    'OTRO',
  ]),
});
