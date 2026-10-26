import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Isolate delivery from local credentials, database and the real email provider.
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./fixtures/not-used-email-test.env', import.meta.url));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@127.0.0.1:3306/not_used';
process.env.JWT_SECRET = 'email-template-test-only';
process.env.CORS_ORIGIN = 'https://cifra.example.test';
process.env.FRONTEND_URL = 'https://cifra.example.test/';
process.env.EMAIL_VERIFICATION_SECRET = 'email-template-test-secret-with-32-characters';
process.env.BREVO_API_KEY = 'not-a-real-provider-key';
process.env.BREVO_SENDER_EMAIL = 'contato@example.test';
process.env.BREVO_API_URL = 'https://email-provider.example.test/never-called';

const { sendVerificationEmail, sendPasswordResetEmail } = await import('../src/services/email.service.js');

interface CapturedEmail {
  subject: string;
  htmlContent: string;
  textContent: string;
  to: Array<{ email: string }>;
}

test('confirmação e recuperação mantêm instruções e links equivalentes em HTML e texto', async (context) => {
  const captured: CapturedEmail[] = [];
  context.mock.method(globalThis, 'fetch', async (_input: unknown, init: RequestInit) => {
    captured.push(JSON.parse(String(init.body)) as CapturedEmail);
    return new Response(null, { status: 201 });
  });
  const token = `token-fixture&outro=valor'"><`;

  await sendVerificationEmail('ana@example.test', token);
  await sendPasswordResetEmail('ana@example.test', token);
  assert.equal(captured.length, 2);

  for (const [index, path, expiry] of [[0, 'verify-email', '24 horas'], [1, 'reset-password', '1 hora']] as const) {
    const email = captured[index]!;
    const link = `https://cifra.example.test/${path}?token=${encodeURIComponent(token)}`;
    const htmlLink = link.replace(/'/g, '&#39;');
    assert.equal(email.to[0]?.email, 'ana@example.test');
    assert.ok(email.textContent.includes(link));
    assert.equal(email.htmlContent.split(`href="${htmlLink}"`).length - 1, 2, 'botão e link alternativo devem apontar ao mesmo destino com escape HTML');
    assert.ok(email.htmlContent.includes(expiry));
    assert.ok(email.textContent.includes(expiry));
    assert.match(email.htmlContent, /ignor/);
    assert.match(email.textContent, /ignor/);
    assert.ok(email.htmlContent.includes('mso-hide:all'), 'preheader oculto para a prévia da caixa de entrada');
    assert.ok(email.htmlContent.includes('lang="pt-BR"'));
    assert.equal(email.htmlContent.includes('token-fixture&outro=valor'), false, 'token deve ser codificado no link');
  }

  assert.ok(captured[0]!.htmlContent.indexOf('informe a senha') < captured[0]!.htmlContent.indexOf('<a href='));
  assert.ok(captured[0]!.textContent.includes('senha que você acabou de criar'));
  assert.ok(captured[1]!.textContent.includes('Sua senha só muda quando você concluir'));
});
