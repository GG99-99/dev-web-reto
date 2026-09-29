import nodemailer, { type Transporter } from 'nodemailer';

/**
 * mail.service.ts
 * ---------------------------------------------------------------------------
 * Envío de correo, implementación simple basada en SMTP (nodemailer).
 * Soporte a RF-04 (notificaciones): cada notificación in-app se puede
 * acompañar de un correo real al usuario.
 *
 * Configuración vía variables de entorno (ver .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * Si SMTP_HOST no está configurado (p. ej. en desarrollo local sin
 * credenciales), el servicio NO lanza error: solo registra el correo en
 * consola. Así el flujo de negocio (asignaciones, notificaciones, etc.)
 * nunca se rompe por falta de configuración de correo.
 * Si el puerto configurado no conecta (587 suele estar bloqueado), reintenta
 * por 465 con TLS implícito, o al revés.
 * ---------------------------------------------------------------------------
 */

let transporter: Transporter | null = null;
let transporterInitialized = false;

function smtpAuth() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  return user && pass ? { user, pass } : undefined;
}

function createSmtpTransport(port: number, secure: boolean): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: smtpAuth(),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { minVersion: 'TLSv1.2' },
  });
}

function getTransporter(): Transporter | null {
  if (transporterInitialized) return transporter;
  transporterInitialized = true;

  if (!process.env.SMTP_HOST) {
    console.warn('[mail] SMTP_HOST no está configurado; los correos solo se registrarán en consola.');
    return null;
  }

  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  transporter = createSmtpTransport(port, secure);

  console.log(`[mail] Cliente SMTP inicializado (${process.env.SMTP_HOST}:${port}, secure: ${secure})`);
  return transporter;
}

/** Port 587 is often blocked on local networks. Implicit TLS on 465 is the other Gmail path. */
function fallbackTransport(error: unknown): Transporter | null {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (!['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'ECONNRESET'].includes(code)) return null;
  if (!process.env.SMTP_HOST || !smtpAuth()) return null;

  const currentPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const nextPort = currentPort === 465 ? 587 : 465;
  const next = createSmtpTransport(nextPort, nextPort === 465);
  console.warn(`[mail] Puerto ${currentPort} no respondió (${code}). Reintentando por ${nextPort}.`);
  return next;
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

    const payload = { from, to, subject, text, html };
    try {
      const info = await client.sendMail(payload);
      console.log(`[mail] ✅ Correo enviado exitosamente a: ${to} | Asunto: "${subject}" | MsgId: ${info.messageId}`);
      return true;
    } catch (error) {
      const fallback = fallbackTransport(error);
      if (fallback) {
        try {
          const info = await fallback.sendMail(payload);
          transporter = fallback;
          console.log(`[mail] ✅ Correo enviado exitosamente a: ${to} | Asunto: "${subject}" | MsgId: ${info.messageId}`);
          return true;
        } catch (fallbackError) {
          console.error(`[mail] ❌ Error enviando correo a ${to}:`, fallbackError);
          return false;
        }
      }
      console.error(`[mail] ❌ Error enviando correo a ${to}:`, error);
      return false;
    }
  },
};
