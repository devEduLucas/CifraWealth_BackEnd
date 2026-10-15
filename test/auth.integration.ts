import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import net from 'node:net';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { signToken } from '../src/utils/jwt.js';

// Local SMTP capture: accepts mail in memory and never delivers it externally.
async function captureSmtp() {
  const messages: string[] = [];
  const sockets = new Set<net.Socket>();
  let rejectMail = false;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 localhost review SMTP\r\n');
    let buffer = '', data = '', readingData = false;
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        if (readingData) {
          if (line === '.') {
            messages.push(data); data = ''; readingData = false;
            socket.write('250 Accepted\r\n');
          } else data += line + '\r\n';
        } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH /i.test(line)) socket.write('235 Authenticated\r\n');
        else if (/^MAIL FROM:/i.test(line) && rejectMail) socket.write('550 Rejected for test\r\n');
        else if (/^DATA$/i.test(line)) { readingData = true; socket.write('354 End with dot\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return {
    port: address.port, messages,
    setRejectMail(value: boolean) { rejectMail = value; },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
    lastToken() {
      const text = messages.at(-1)!.replace(/=\r\n/g, '').replace(/=([\dA-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      const token = text.match(/[?&]token=([\w.%_-]+)/)?.[1];
      assert.ok(token, 'O e-mail deve conter o link de confirmação.');
      return decodeURIComponent(token);
    },
  };
}

test('cadastro e confirmação reais com SMTP local, senhas vinculadas e limpeza', async (t) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname), 'Somente MySQL local.');
  const originalEnv = { ...env };
  const smtp = await captureSmtp();
  Object.assign(env, {
    NODE_ENV: 'test', SMTP_HOST: '127.0.0.1', SMTP_PORT: smtp.port, SMTP_SECURE: false,
    SMTP_USER: 'local-test', SMTP_PASS: 'local-test', SMTP_FROM: 'local@example.com',
    FRONTEND_URL: 'http://localhost:5173', EMAIL_VERIFICATION_SECRET: randomBytes(32).toString('hex'),
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const emails: string[] = [];
  const password = 'CadastroInicial!123', nextPassword = 'CadastroSeguinte!456';
  const request = async (route: string, body: unknown) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  const newEmail = () => { const email = `auth-review-${randomUUID()}@example.com`; emails.push(email); return email; };
  const register = (email: string, pass = password) => request('/users/register', { fullName: 'Teste Cadastro', email, password: pass });
  const age = (email: string) => prisma.usuarios.update({ where: { email }, data: { updated_at: new Date(Date.now() - 61_000) } });

  try {
    await t.test('exige link e senha corretos e separa tokens de acesso/ativação', async () => {
      const email = newEmail();
      assert.equal((await register(email)).status, 201);
      const token = smtp.lastToken();
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
      const firstToken = smtp.lastToken();
      assert.equal((await register(email, nextPassword)).status, 429);
      await age(email);
      assert.equal((await register(email, nextPassword)).status, 201);
      const latestToken = smtp.lastToken();
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
      const count = smtp.messages.length;
      const recent = await request('/users/resend-verification', { email });
      assert.equal(recent.status, 200); assert.equal(smtp.messages.length, count);
      await age(email);
      const resent = await request('/users/resend-verification', { email });
      assert.equal(resent.status, 200); assert.equal(smtp.messages.length, count + 1);
      const missing = await request('/users/resend-verification', { email: newEmail() });
      assert.deepEqual(missing, resent);
      assert.equal((await request('/users/verify-email', { token: smtp.lastToken(), password })).status, 200);
    });

    await t.test('falha SMTP remove somente o cadastro não ativado da tentativa', async () => {
      const email = newEmail(); smtp.setRejectMail(true);
      try {
        assert.equal((await register(email)).status, 502);
        assert.equal(await prisma.usuarios.findUnique({ where: { email } }), null);
      } finally { smtp.setRejectMail(false); }
    });

    await t.test('sem configuração de envio, cadastro real retorna indisponibilidade', async () => {
      const previous = env.SMTP_HOST; env.SMTP_HOST = undefined;
      try { assert.equal((await register(newEmail())).status, 503); }
      finally { env.SMTP_HOST = previous; }
    });
  } finally {
    try {
      const users = await prisma.usuarios.findMany({ where: { email: { in: emails } }, select: { id_usuario: true } });
      const ids = users.map((user) => user.id_usuario);
      await prisma.categorias.deleteMany({ where: { id_usuario: { in: ids } } });
      await prisma.usuarios.deleteMany({ where: { id_usuario: { in: ids } } });
    } finally {
      Object.assign(env, originalEnv);
      try { await new Promise<void>((resolve) => server.close(() => resolve())); }
      finally { await smtp.close(); await prisma.$disconnect(); }
    }
  }
});
