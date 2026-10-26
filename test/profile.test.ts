import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import {
  updateProfileSchema,
  deleteAccountSchema,
} from "../src/types/user.types.js";
import {
  createAccountDeletionChallenge,
  readAccountDeletionChallenge,
} from "../src/utils/accountDeletionToken.js";
import { createPasswordResetToken } from "../src/utils/PasswordResetToken.js";
import { sessionVersion, signToken, verifyToken } from "../src/utils/jwt.js";
import type { Request, Response } from "express";
import { userController } from "../src/controllers/user.controller.js";
import { profileService } from "../src/services/profile.service.js";
import { toUserResponse } from "../src/services/user.service.js";
import { userRepository } from "../src/repositories/user.repository.js";
import { AppError } from "../src/utils/AppError.js";

const user = {
  id_usuario: 123,
  email: "profile@example.test",
  senha: "hash-fixture",
  google_id: "google-fixture",
};
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+sD1cAAAAASUVORK5CYII=";

test("perfil aceita imagens limitadas e impede SVG, MIME forjado, excesso e troca de e-mail", () => {
  assert.ok(
    updateProfileSchema.safeParse({
      fullName: "Nome Sobrenome",
      avatar: png,
      cover: png,
    }).success,
  );
  assert.ok(
    updateProfileSchema.safeParse({
      fullName: "Nome Sobrenome",
      avatar: null,
      cover: null,
    }).success,
  );
  for (const input of [
    {
      avatar:
        "data:image/svg+xml;base64," +
        Buffer.from('<svg onload="alert(1)"/>').toString("base64"),
    },
    { avatar: png.replace("image/png", "image/jpeg") },
    { avatar: "https://example.test/foto.png" },
    {
      cover: "data:image/png;base64," + Buffer.alloc(204801).toString("base64"),
    },
    { email: "outro@example.test" },
    { id_usuario: 456 },
    { fullName: "N".repeat(51) },
  ])
    assert.equal(
      updateProfileSchema.safeParse({ fullName: "Nome Sobrenome", ...input })
        .success,
      false,
    );
});

test("exclusão exige uma única credencial e não aceita selecionar outra conta", () => {
  assert.ok(
    deleteAccountSchema.safeParse({ password: "SenhaCorreta!123" }).success,
  );
  assert.ok(
    deleteAccountSchema.safeParse({
      googleIdToken: "google-proof",
      challengeToken: "delete-challenge",
    }).success,
  );
  for (const body of [
    {},
    { password: "" },
    { password: "x", id_usuario: 456 },
    { password: "x", googleIdToken: "x", challengeToken: "x" },
    { googleIdToken: "x" },
  ])
    assert.equal(deleteAccountSchema.safeParse(body).success, false);
});

const profile = {
  id_usuario: user.id_usuario,
  nome: "Nome",
  sobrenome: "Sobrenome",
  email: user.email,
  foto_perfil: png,
  capa_perfil: png,
  tem_senha: true,
  acesso_google: true,
};

test("resposta de perfil preserva imagens e formas de acesso sem expor credenciais", () => {
  assert.deepEqual(toUserResponse({ ...user, ...profile }), profile);
  assert.deepEqual(toUserResponse({ ...user, ...profile, senha: null, google_id: null, foto_perfil: null, capa_perfil: null }), {
    ...profile, foto_perfil: null, capa_perfil: null, tem_senha: false, acesso_google: false,
  });
});

function responseCapture() {
  let statusCode: number | undefined;
  let body: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as Response;
  return { res, read: () => ({ statusCode, body }) };
}

test("leitura e atualização do perfil usam o contrato completo do serviço", async (context) => {
  context.mock.method(userRepository, "findById", async () => { throw new Error("A leitura deve usar o serviço de perfil."); });
  context.mock.method(userRepository, "updateProfile", async () => { throw new Error("A atualização deve usar o serviço de perfil."); });
  const get = context.mock.method(profileService, "get", async () => profile);
  const update = context.mock.method(profileService, "update", async () => profile);
  const body = { fullName: "Nome Sobrenome", avatar: png, cover: png };
  const req = { userId: user.id_usuario, body } as Request;
  const next = context.mock.fn();

  for (const handler of [userController.getProfile, userController.updateProfile]) {
    const captured = responseCapture();
    await handler(req, captured.res, next);
    assert.deepEqual(captured.read(), { statusCode: 200, body: profile });
  }
  assert.deepEqual(get.mock.calls[0]?.arguments, [user.id_usuario]);
  assert.deepEqual(update.mock.calls[0]?.arguments, [user.id_usuario, body]);
  assert.equal(next.mock.callCount(), 0);
});

test("desafio e exclusão só retornam sucesso após executar o serviço autenticado", async (context) => {
  const challenge = { challengeToken: "mock-challenge", nonce: "mock-nonce" };
  const result = { message: "Conta e dados financeiros excluídos com sucesso." };
  const challengeCall = context.mock.method(profileService, "deletionChallenge", async () => challenge);
  const deleteCall = context.mock.method(profileService, "delete", async () => result);
  const body = { password: "senha-fixture" };
  const req = { userId: user.id_usuario, body } as Request;
  const next = context.mock.fn();

  for (const [handler, expected] of [[userController.deletionChallenge, challenge], [userController.deleteAccount, result]] as const) {
    const captured = responseCapture();
    await handler(req, captured.res, next);
    assert.deepEqual(captured.read(), { statusCode: 200, body: expected });
  }
  assert.deepEqual(challengeCall.mock.calls[0]?.arguments, [user.id_usuario]);
  assert.deepEqual(deleteCall.mock.calls[0]?.arguments, [user.id_usuario, body]);
  assert.equal(next.mock.callCount(), 0);
});

test("credencial recusada na exclusão propaga erro sem responder sucesso", async (context) => {
  const denied = new AppError("Senha incorreta.", 403);
  context.mock.method(profileService, "delete", async () => { throw denied; });
  const captured = responseCapture();
  const next = context.mock.fn();
  await userController.deleteAccount({ userId: user.id_usuario, body: { password: "incorreta" } } as Request, captured.res, next);
  assert.equal(next.mock.callCount(), 1);
  assert.deepEqual(next.mock.calls[0]?.arguments, [denied]);
  assert.equal(captured.read().body, undefined);
});

test("confirmação Google é vinculada à conta e às credenciais, sem autenticar uma sessão", () => {
  const challenge = createAccountDeletionChallenge(user);
  assert.equal(
    readAccountDeletionChallenge(challenge.challengeToken, user),
    challenge.nonce,
  );
  assert.throws(() =>
    readAccountDeletionChallenge(challenge.challengeToken, {
      ...user,
      id_usuario: 456,
    }),
  );
  assert.throws(() =>
    readAccountDeletionChallenge(challenge.challengeToken, {
      ...user,
      senha: "nova-senha",
    }),
  );
  assert.throws(() =>
    readAccountDeletionChallenge(challenge.challengeToken, {
      ...user,
      google_id: "outra-conta",
    }),
  );
  assert.throws(() => verifyToken(challenge.challengeToken));
});

test("confirmação de exclusão rejeita expiração, adulteração e tokens de outras finalidades", () => {
  const challenge = createAccountDeletionChallenge(user);
  const payload = jwt.decode(challenge.challengeToken) as jwt.JwtPayload;
  const expired = jwt.sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) - 1 },
    env.JWT_SECRET,
    { algorithm: "HS256" },
  );
  assert.throws(() => readAccountDeletionChallenge(expired, user));
  assert.throws(() =>
    readAccountDeletionChallenge(challenge.challengeToken + "x", user),
  );
  assert.throws(() =>
    readAccountDeletionChallenge(
      signToken({
        userId: user.id_usuario,
        credentialVersion: sessionVersion(user),
      }),
      user,
    ),
  );
  assert.throws(() =>
    readAccountDeletionChallenge(createPasswordResetToken(user), user),
  );
});
