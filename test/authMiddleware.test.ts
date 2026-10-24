import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type { usuarios } from "../src/generated/prisma/client.js";
import { authMiddleware } from "../src/middlewares/auth.middleware.js";
import { errorMiddleware } from "../src/middlewares/error.middleware.js";
import { userRepository } from "../src/repositories/user.repository.js";
import { AppError } from "../src/utils/AppError.js";
import { sessionVersion, signToken } from "../src/utils/jwt.js";

const user: usuarios = {
  id_usuario: 123,
  nome: "Autenticação",
  sobrenome: "Teste",
  email: "auth-middleware@example.test",
  senha: "fixture-hash",
  google_id: null,
  foto_perfil: null,
  capa_perfil: null,
  email_verificado: true,
  ultimo_login: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const accessToken = signToken({
  userId: user.id_usuario,
  credentialVersion: sessionVersion(user),
});

async function authenticate(token: string) {
  const req = { headers: { authorization: `Bearer ${token}` } } as Request;
  const calls: unknown[] = [];
  await authMiddleware(req, {} as Response, (error?: unknown) => {
    calls.push(error);
  });
  assert.equal(calls.length, 1);
  return { req, error: calls[0] };
}

test("token inválido retorna 401 sem consultar o repositório", async (t) => {
  const find = t.mock.method(userRepository, "findById", async () => user);
  const { req, error } = await authenticate("invalid-token");
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
  assert.equal(req.userId, undefined);
  assert.equal(find.mock.callCount(), 0);
});

test("falha do repositório retorna 500 sem invalidar a sessão nem expor detalhes", async (t) => {
  const unavailable = new Error("SIMULATED_DATABASE_UNAVAILABLE");
  t.mock.method(userRepository, "findById", async () => {
    throw unavailable;
  });
  const log = t.mock.method(console, "error", () => {});
  const { req, error } = await authenticate(accessToken);
  assert.equal(error, unavailable);
  assert.equal(req.userId, undefined);

  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as Response;
  errorMiddleware(error, req, res, () => {});
  assert.equal(statusCode, 500);
  assert.deepEqual(body, { message: "Erro interno do servidor." });
  assert.equal(log.mock.callCount(), 1);
});

test("sessão válida continua autenticando após uma tentativa com falha temporária", async (t) => {
  let unavailable = true;
  t.mock.method(userRepository, "findById", async () => {
    if (unavailable) throw new Error("SIMULATED_DATABASE_UNAVAILABLE");
    return user;
  });
  assert.ok((await authenticate(accessToken)).error instanceof Error);
  unavailable = false;
  const { req, error } = await authenticate(accessToken);
  assert.equal(error, undefined);
  assert.equal(req.userId, user.id_usuario);
});

test("sessão revogada continua retornando 401 e não autentica o usuário", async (t) => {
  t.mock.method(userRepository, "findById", async () => ({
    ...user,
    senha: "credentials-changed",
  }));
  const { req, error } = await authenticate(accessToken);
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 401);
  assert.equal(req.userId, undefined);
});
