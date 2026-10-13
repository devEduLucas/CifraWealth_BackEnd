import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.SMTP_FROM &&
      env.FRONTEND_URL &&
      env.EMAIL_VERIFICATION_SECRET
  );
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  if (!isEmailDeliveryConfigured()) {
    throw new AppError(
      "A confirmação por e-mail ainda não está configurada no servidor. Configure as variáveis SMTP para habilitar cadastros.",
      503
    );
  }

  const verificationUrl = `${env.FRONTEND_URL!.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;

  // Log in development for easy debugging and immediate testing
  if (env.NODE_ENV === "development") {
    console.log(`[SMTP] Iniciando envio para: ${email}`);
    console.log(`[SMTP - Link Direto de Confirmação]: ${verificationUrl}`);
  }

  const transportConfig =
    env.SMTP_HOST === "smtp.gmail.com"
      ? {
          service: "gmail",
          auth: {
            user: env.SMTP_USER!,
            pass: env.SMTP_PASS!,
          },
        }
      : {
          host: env.SMTP_HOST!,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE,
          auth: {
            user: env.SMTP_USER!,
            pass: env.SMTP_PASS!,
          },
        };

  const transporter = nodemailer.createTransport(transportConfig);

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM!,
      to: email,
      subject: "Confirme seu e-mail — Cifra Wealth",
      text: [
        "Olá!",
        "",
        "Para concluir seu cadastro no Cifra Wealth, confirme que você tem acesso a este e-mail pelo link abaixo:",
        verificationUrl,
        "",
        "Este link expira em 24 horas. Se você não solicitou o cadastro, ignore esta mensagem.",
        "",
        "Cifra Wealth",
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:0 auto;padding:24px">
          <h1 style="color:#0f766e;margin-bottom:8px">Confirme seu e-mail</h1>
          <p>Olá!</p>
          <p>Para concluir seu cadastro no <strong>Cifra Wealth</strong>, confirme que você tem acesso a este endereço de e-mail.</p>
          <p style="margin:28px 0">
            <a href="${verificationUrl}" style="display:inline-block;background:#14b8a6;color:#062a2a;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px">Confirmar e-mail</a>
          </p>
          <p>Este link expira em <strong>24 horas</strong>. Se você não solicitou o cadastro, ignore esta mensagem.</p>
          <p style="color:#64748b;font-size:12px;margin-top:28px">Cifra Wealth</p>
        </div>
      `,
    });

    if (env.NODE_ENV === "development") {
      console.log(`[SMTP] E-mail enviado com sucesso! MessageID: ${info.messageId}`);
    }
  } catch (error) {
    console.error("[SMTP - Erro ao enviar e-mail]:", error);
    throw error;
  }
}
