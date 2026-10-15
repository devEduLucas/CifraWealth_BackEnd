import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

/**
 * Verifica se as credenciais da Brevo estão configuradas no ambiente.
 */
export function isBrevoDeliveryConfigured(): boolean {
  return Boolean(
    env.BREVO_API_KEY &&
      env.BREVO_SENDER_EMAIL &&
      env.FRONTEND_URL &&
      env.EMAIL_VERIFICATION_SECRET
  );
}

/**
 * Verifica se o envio de e-mails está disponível para o usuário.
 * Em desenvolvimento, permite prosseguir sem a chave da Brevo
 * através de simulação com link exibido no console.
 */
export function isEmailDeliveryConfigured(): boolean {
  if (env.NODE_ENV === "development") {
    return Boolean(env.FRONTEND_URL && env.EMAIL_VERIFICATION_SECRET);
  }
  return isBrevoDeliveryConfigured();
}

/**
 * Envia o e-mail de confirmação de cadastro via API REST oficial da Brevo (HTTPS porta 443).
 * Em modo de desenvolvimento, caso a chave não esteja presente, exibe o link no console.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const frontendUrl = env.FRONTEND_URL ? env.FRONTEND_URL.replace(/\/+$/, "") : "http://localhost:5173";
  const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  // Simulação amigável em ambiente de desenvolvimento quando a chave não estiver configurada
  if (!isBrevoDeliveryConfigured()) {
    if (env.NODE_ENV === "development") {
      console.log("\n========================================================");
      console.log("📨 [DEV] SIMULAÇÃO DE E-MAIL DE CONFIRMAÇÃO (BREVO NÃO CONFIGURADO)");
      console.log(`Destinatário: ${email}`);
      console.log("Link de Ativação:");
      console.log(verificationUrl);
      console.log("========================================================\n");
      return;
    }

    throw new AppError(
      "A confirmação por e-mail ainda não está configurada no servidor. Configure as variáveis da Brevo (BREVO_API_KEY e BREVO_SENDER_EMAIL) para habilitar cadastros.",
      503
    );
  }

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

  try {
    const response = await fetch(env.BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY!,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`Falha na API Brevo HTTP ${response.status}:`, errorText);
      throw new Error(`Brevo HTTP ${response.status}`);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Falha no serviço de envio de e-mail Brevo:", error);
    throw new AppError("Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.", 502);
  }
}
