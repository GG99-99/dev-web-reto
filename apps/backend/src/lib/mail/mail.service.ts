import nodemailer, { type Transporter } from 'nodemailer';

/**
 * mail.service.ts
 * ---------------------------------------------------------------------------
 * Envío de correo, implementación simple basada en SMTP (nodemailer).
 * Soporte a RF-04 (notificaciones): cada notificación in-app se puede
 * acompañar de un correo real al usuario.
 *
 * Configuración vía variables de entorno (ver env-example.txt):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * Si SMTP_HOST no está configurado (p. ej. en desarrollo local sin
 * credenciales), el servicio NO lanza error: solo registra el correo en
 * consola. Así el flujo de negocio (asignaciones, notificaciones, etc.)
 * nunca se rompe por falta de configuración de correo.
 * ---------------------------------------------------------------------------
 */

let transporter: Transporter | null = null;
let transporterInitialized = false;

function getTransporter(): Transporter | null {
  if (transporterInitialized) return transporter;
  transporterInitialized = true;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST) {
    console.warn('[mail] SMTP_HOST no está configurado; los correos solo se registrarán en consola.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: SMTP_SECURE === 'true', // true para puerto 465, false para el resto (STARTTLS)
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  console.log(`[mail] Cliente SMTP inicializado (${SMTP_HOST}:${SMTP_PORT ? Number(SMTP_PORT) : 587}, secure: ${SMTP_SECURE === 'true'})`);
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const mailService = {
  /**
   * Envía un correo. Nunca lanza: si falla (o si no hay SMTP configurado),
   * se registra el error/aviso en consola y se retorna `false`, para no
   * interrumpir el flujo de negocio que disparó el envío.
   */
  sendMail: async ({ to, subject, text, html }: SendMailInput): Promise<boolean> => {
    const from = process.env.MAIL_FROM || 'no-reply@reto.local';
    const client = getTransporter();

    if (!client) {
      console.log(`[mail] (simulado) Para: ${to} | Asunto: ${subject}\n${text}`);
      return false;
    }

    try {
      const info = await client.sendMail({ from, to, subject, text, html });
      console.log(`[mail] ✅ Correo enviado exitosamente a: ${to} | Asunto: "${subject}" | MsgId: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`[mail] ❌ Error enviando correo a ${to}:`, error);
      return false;
    }
  },
};
