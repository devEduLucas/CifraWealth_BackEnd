import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { signToken } from '../src/utils/jwt.js';

// Servidor mock da API REST da Brevo (recebe requisições HTTP em memória)
async function captureBrevo() {
  const messages: Array<{ htmlContent?: string; to?: Array<{ email: string }> }> = [];
  let rejectMail = false;

  const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        if (rejectMail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Internal Server Error' }));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          messages.push(parsed);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ messageId: `<mock-${Date.now()}@brevo>` }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Invalid payload' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  return {
    url: `http://127.0.0.1:${address.port}/v3/smtp/email`,
    messages,
    setRejectMail(value: boolean) { rejectMail = value; },
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
    lastToken() {
      const last = messages.at(-1);
      assert.ok(last, 'Deve existir e-mail registrado na fila da Brevo.');
      const html = last.htmlContent || '';
      const token = html.match(/[?&]token=([\w.%_-]+)/)?.[1];
      assert.ok(token, 'O e-mail deve conter o token de confirmação.');
      return decodeURIComponent(token);
    },
  };
}

test('cadastro e confirmação reais com API Brevo mock, senhas vinculadas e limpeza', async (t) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname), 'Somente MySQL local.');

  const originalEnv = { ...env };
  const brevoMock = await captureBrevo();

  Object.assign(env, {
    NODE_ENV: 'test',
    BREVO_API_KEY: 'test-api-key',
    BREVO_SENDER_EMAIL: 'contato@cifrawealth.com',
    BREVO_SENDER_NAME: 'Cifra Wealth',
    BREVO_API_URL: brevoMock.url,
    FRONTEND_URL: 'http://localhost:5173',
    EMAIL_VERIFICATION_SECRET: randomBytes(32).toString('hex'),
  });

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;

  const emails: string[] = [];
  const password = 'CadastroInicial!123', nextPassword = 'CadastroSeguinte!456';

  const request = async (route: string, body: unknown) => {
    const response = await fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };

  const newEmail = () => {
    const email = `auth-review-${randomUUID()}@example.com`;
    emails.push(email);
    return email;
  };

  const register = (email: string, pass = password) =>
    request('/users/register', { fullName: 'Teste Cadastro', email, password: pass });

  const age = (email: string) =>
    prisma.usuarios.update({ where: { email }, data: { updated_at: new Date(Date.now() - 61_000) } });

  try {
    await t.test('exige link e senha corretos e separa tokens de acesso/ativação', async () => {
      const email = newEmail();
      assert.equal((await register(email)).status, 201);
      const token = brevoMock.lastToken();

      assert.equal((await request('/auth/login', { email, password })).status, 403);
      assert.equal((await request('/users/verify-email', { token })).status, 400);
      assert.equal((await request('/users/verify-email', { token, password: nextPassword })).status, 400);

      const user = await prisma.usuarios.findUniqueOrThrow({ where: { email } });
      assert.equal(user.email_verificado, false);
      assert.equal((await request('/users/verify-email', { token: signToken({ userId: user.id_usuario }), password })).status, 400);

      const protectedResponse = await fetch(base + '/goals', { headers: { Authorization: 'Bearer ' + token } });
      assert.equal(protectedResponse.status, 401);

      assert.equal((await request('/users/verify-email', { token, password })).status, 200);
      assert.equal((await request('/users/verify-email', { token, password })).status, 200);
      assert.equal((await request('/auth/login', { email, password })).status, 200);
      assert.equal((await register(email)).status, 409);
    });

    await t.test('novo cadastro pendente invalida o link e a senha anteriores', async () => {
      const email = newEmail();
      assert.equal((await register(email)).status, 201);
      const firstToken = brevoMock.lastToken();

      assert.equal((await register(email, nextPassword)).status, 429);
      await age(email);
      assert.equal((await register(email, nextPassword)).status, 201);
      const latestToken = brevoMock.lastToken();
      assert.notEqual(latestToken, firstToken);

      assert.equal((await request('/users/verify-email', { token: firstToken, password })).status, 400);
      assert.equal((await request('/users/verify-email', { token: latestToken, password })).status, 400);
      assert.equal((await request('/users/verify-email', { token: latestToken, password: nextPassword })).status, 200);
      assert.equal((await request('/auth/login', { email, password })).status, 401);
      assert.equal((await request('/auth/login', { email, password: nextPassword })).status, 200);
    });

    await t.test('reenvio preserva credenciais e respeita cooldown sem enumerar contas', async () => {
      const email = newEmail();
      assert.equal((await register(email)).status, 201);
      const count = brevoMock.messages.length;

      const recent = await request('/users/resend-verification', { email });
      assert.equal(recent.status, 200);
      assert.equal(brevoMock.messages.length, count);

      await age(email);
      const resent = await request('/users/resend-verification', { email });
      assert.equal(resent.status, 200);
      assert.equal(brevoMock.messages.length, count + 1);

      const missing = await request('/users/resend-verification', { email: newEmail() });
      assert.deepEqual(missing, resent);

      assert.equal((await request('/users/verify-email', { token: brevoMock.lastToken(), password })).status, 200);
    });

    await t.test('falha na API da Brevo remove somente o cadastro não ativado da tentativa', async () => {
      const email = newEmail();
      brevoMock.setRejectMail(true);
      try {
        assert.equal((await register(email)).status, 502);
        assert.equal(await prisma.usuarios.findUnique({ where: { email } }), null);
      } finally {
        brevoMock.setRejectMail(false);
      }
    });

    await t.test('sem configuração de envio, cadastro real retorna indisponibilidade', async () => {
      const previous = env.BREVO_API_KEY;
      env.BREVO_API_KEY = undefined;
      try {
        assert.equal((await register(newEmail())).status, 503);
      } finally {
        env.BREVO_API_KEY = previous;
      }
    });
  } finally {
    try {
      const users = await prisma.usuarios.findMany({ where: { email: { in: emails } }, select: { id_usuario: true } });
      const ids = users.map((user) => user.id_usuario);
      await prisma.categorias.deleteMany({ where: { id_usuario: { in: ids } } });
      await prisma.usuarios.deleteMany({ where: { id_usuario: { in: ids } } });
    } finally {
      Object.assign(env, originalEnv);
      try {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      } finally {
        await brevoMock.close();
        await prisma.$disconnect();
      }
    }
  }
});
