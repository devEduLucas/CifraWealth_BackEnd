import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function isBrevoDeliveryConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.FRONTEND_URL && env.EMAIL_VERIFICATION_SECRET);
}

export function isEmailDeliveryConfigured(): boolean { return isBrevoDeliveryConfigured(); }

function requireDelivery() {
  if (!isBrevoDeliveryConfigured()) throw new AppError("O envio de e-mails está temporariamente indisponível. Configure a Brevo no servidor.", 503);
}

interface BrevoPayload {
  sender: { name: string; email: string };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
  textContent: string;
}

async function deliver(payload: BrevoPayload, failureMessage: string) {
  try {
    const response = await fetch(env.BREVO_API_URL, {
      method: "POST",
      headers: { accept: "application/json", "api-key": env.BREVO_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.BREVO_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) {
      console.error("Falha no envio Brevo. HTTP:", response.status);
      throw new AppError(failureMessage, 502);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Do not log request data, provider response bodies, tokens or recipient addresses.
    console.error("Falha no envio Brevo:", error instanceof Error ? error.name : "DELIVERY_ERROR");
    throw new AppError(failureMessage, 502);
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  requireDelivery();
  const verificationUrl = `${env.FRONTEND_URL!.replace(/\/+$/, "")}/verify-email?token=${encodeURIComponent(token)}`;

  const emailPayload = {
    sender: {
      name: env.BREVO_SENDER_NAME || "Cifra Wealth",
      email: env.BREVO_SENDER_EMAIL!,
    },
    to: [
      {
        email,
      },
    ],
    subject: "Confirme seu e-mail — Cifra Wealth",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #172033; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #0f766e; margin-bottom: 8px;">Confirme seu e-mail</h1>
        <p>Olá!</p>
        <p>Para concluir seu cadastro no <strong>Cifra Wealth</strong>, confirme que você tem acesso a este endereço de e-mail.</p>
        <p style="margin: 28px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background: #14b8a6; color: #062a2a; text-decoration: none; font-weight: 700; padding: 13px 22px; border-radius: 8px;">Confirmar e-mail</a>
        </p>
        <p>Este link expira em <strong>24 horas</strong>. Se você não solicitou o cadastro, ignore esta mensagem.</p>
        <p>Ao abrir o link, informe a senha escolhida nesta tentativa de cadastro para ativar a conta.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 28px;">Equipe Cifra Wealth</p>
      </div>
    `,
    textContent: [
      "Olá!",
      "",
      "Para concluir seu cadastro no Cifra Wealth, confirme que você tem acesso a este e-mail pelo link abaixo:",
      verificationUrl,
      "",
      "Este link expira em 24 horas. Se você não solicitou o cadastro, ignore esta mensagem.",
      "Ao abrir o link, informe a senha escolhida nesta tentativa de cadastro para ativar a conta.",
      "",
      "Cifra Wealth",
    ].join("\n"),
  };

  await deliver(emailPayload, "Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.");
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  requireDelivery();
  const resetUrl = `${env.FRONTEND_URL!.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  const emailPayload = {
    sender: {
      name: env.BREVO_SENDER_NAME || "Cifra Wealth",
      email: env.BREVO_SENDER_EMAIL!,
    },
    to: [
      {
        email,
      },
    ],
    subject: "Redefinição de senha — Cifra Wealth",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #172033; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #0f766e; margin-bottom: 8px;">Redefinir sua senha</h1>
        <p>Olá!</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Cifra Wealth</strong>.</p>
        <p style="margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #14b8a6; color: #062a2a; text-decoration: none; font-weight: 700; padding: 13px 22px; border-radius: 8px;">Criar nova senha</a>
        </p>
        <p>Este link expira em <strong>1 hora</strong>. Se você não solicitou a alteração de senha, ignore esta mensagem com segurança.</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 28px;">Equipe Cifra Wealth</p>
      </div>
    `,
    textContent: [
      "Olá!",
      "",
      "Recebemos uma solicitação para redefinir sua senha no Cifra Wealth.",
      "Acesse o link abaixo para criar uma nova senha:",
      resetUrl,
      "",
      "Este link expira em 1 hora. Se você não solicitou a redefinição, nenhuma ação é necessária.",
      "",
      "Cifra Wealth",
    ].join("\n"),
  };

  await deliver(emailPayload, "Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.");
}
