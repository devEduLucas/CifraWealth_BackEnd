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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

interface AccountEmailContent {
  title: string;
  preheader: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  expiry: string;
  notice: string;
}

function accountEmail(content: AccountEmailContent): Pick<BrevoPayload, "htmlContent" | "textContent"> {
  const url = escapeHtml(content.actionUrl);
  return {
    htmlContent: `<!doctype html>
      <html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033;">
        <div style="display:none!important;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}</div>
        <table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">
          <table role="presentation" style="width:100%;max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;border-radius:16px;">
            <tr><td style="padding:28px 24px 0;font-size:19px;font-weight:700;color:#2563eb;">CifraWealth</td></tr>
            <tr><td style="padding:20px 24px 28px;line-height:1.6;">
              <h1 style="font-size:26px;line-height:1.25;margin:0 0 20px;color:#172033;">${escapeHtml(content.title)}</h1>
              ${content.paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:15px;">${escapeHtml(paragraph)}</p>`).join("")}
              <table role="presentation" style="border-collapse:collapse;margin:24px 0;"><tr><td style="background:#2563eb;border-radius:8px;">
                <a href="${url}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(content.actionLabel)}</a>
              </td></tr></table>
              <p style="margin:0 0 16px;font-size:14px;">${escapeHtml(content.expiry)}</p>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;">${escapeHtml(content.notice)}</p>
              <div style="border-top:1px solid #dbe4ef;padding-top:20px;color:#475569;font-size:12px;">
                <p style="margin:0 0 8px;">Se o botão não abrir, copie este link e cole no navegador:</p>
                <p style="margin:0;word-break:break-all;overflow-wrap:anywhere;"><a href="${url}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${url}</a></p>
                <p style="margin:20px 0 0;">Equipe CifraWealth</p>
              </div>
            </td></tr>
          </table>
        </td></tr></table>
      </body></html>`,
    textContent: ["CifraWealth", "", content.title, "", ...content.paragraphs.flatMap((paragraph) => [paragraph, ""]), content.actionLabel, content.actionUrl, "", content.expiry, content.notice, "", "Equipe CifraWealth"].join("\n"),
  };
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
    subject: "Confirme seu e-mail — CifraWealth",
    ...accountEmail({
      title: "Confirme seu e-mail",
      preheader: "Abra o link e informe a senha criada no cadastro para ativar sua conta.",
      paragraphs: [
        "Olá! Falta confirmar este endereço de e-mail para concluir seu cadastro na CifraWealth.",
        "Ao abrir o link, informe a senha que você acabou de criar no cadastro. Depois da confirmação, você poderá entrar na sua conta.",
      ],
      actionLabel: "Confirmar e-mail",
      actionUrl: verificationUrl,
      expiry: "Este link de confirmação é válido por 24 horas.",
      notice: "Se você não solicitou este cadastro, pode ignorar a mensagem.",
    }),
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
    subject: "Criar nova senha — CifraWealth",
    ...accountEmail({
      title: "Criar nova senha",
      preheader: "Escolha uma nova senha pelo link, válido por 1 hora. Seus registros continuam na conta.",
      paragraphs: [
        "Olá! Recebemos uma solicitação para criar uma nova senha para sua conta na CifraWealth.",
        "Abra o link abaixo e escolha sua nova senha. Seus registros continuam na mesma conta.",
      ],
      actionLabel: "Criar nova senha",
      actionUrl: resetUrl,
      expiry: "Este link de redefinição é válido por 1 hora.",
      notice: "Sua senha só muda quando você concluir esta etapa. Se não fez a solicitação, ignore esta mensagem; nenhuma ação é necessária.",
    }),
  };

  await deliver(emailPayload, "Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde.");
}
