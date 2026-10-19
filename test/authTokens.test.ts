import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { matchesSessionVersion, sessionVersion, signToken, verifyToken } from '../src/utils/jwt.js';
import { createPasswordResetToken, matchesPasswordResetToken, readPasswordResetToken } from '../src/utils/PasswordResetToken.js';

const user = { id_usuario: 1, email: 'tokens@example.com', senha: 'hash-da-fixture', google_id: null };

test('sessões são vinculadas às credenciais sem colocar a senha no token', () => {
  const token = signToken({ userId: user.id_usuario, credentialVersion: sessionVersion(user) });
  const claims = verifyToken(token);
  assert.equal(claims.userId, user.id_usuario);
  assert.ok(matchesSessionVersion(claims.credentialVersion, user));
  assert.equal(matchesSessionVersion(claims.credentialVersion, { ...user, senha: 'outro-hash' }), false);
  assert.equal(matchesSessionVersion(claims.credentialVersion, { ...user, google_id: 'outra-identidade' }), false);
  assert.equal('senha' in (jwt.decode(token) as object), false);
});

test('tokens de recuperação não autenticam sessões e tokens de acesso não redefinem senha', () => {
  const access = signToken({ userId: user.id_usuario, credentialVersion: sessionVersion(user) });
  const reset = createPasswordResetToken(user);
  assert.throws(() => verifyToken(reset));
  assert.throws(() => readPasswordResetToken(access));
  const claims = readPasswordResetToken(reset);
  assert.ok(matchesPasswordResetToken(claims.version, user));
  assert.equal(matchesPasswordResetToken(claims.version, { ...user, senha: 'outro-hash' }), false);
});

test('sessões antigas sem versão e tokens expirados são rejeitados', () => {
  const legacy = jwt.sign({ userId: user.id_usuario, purpose: 'access' }, env.JWT_SECRET, { algorithm: 'HS256' });
  const expired = jwt.sign({ userId: user.id_usuario, purpose: 'access', credentialVersion: sessionVersion(user) }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -1 });
  assert.throws(() => verifyToken(legacy));
  assert.throws(() => verifyToken(expired));
});
