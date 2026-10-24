import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import {
  OAuth2Client,
  LoginTicket,
  type TokenPayload,
} from "google-auth-library";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/hashPassword.js";
import { sessionVersion, signToken } from "../src/utils/jwt.js";
import { userRepository } from "../src/repositories/user.repository.js";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+sD1cAAAAASUVORK5CYII=";

test("perfil real: persistência, imagens, isolamento, confirmação e exclusão transacional", async (t) => {
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(env.DATABASE_URL).hostname,
    ),
    "Somente MySQL local.",
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const ids: number[] = [];
  const password = "PerfilSeguro!123";
  const hash = await hashPassword(password);
  const originalGoogleId = env.GOOGLE_CLIENT_ID;
  async function request(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      data: await response.json().catch(() => null),
    };
  }
  try {
    const users = [];
    for (const name of ["A", "B", "Race", "Google"]) {
      const user = await prisma.usuarios.create({
        data: {
          nome: "Perfil",
          sobrenome: name,
          email: `profile-${name}-${randomUUID()}@example.test`,
          senha: name === "Google" ? null : hash,
          google_id: name === "Google" ? randomUUID() : null,
          email_verificado: true,
          categorias: { create: { nome: "Receita local", tipo: "receita" } },
        },
      });
      ids.push(user.id_usuario);
      users.push({
        ...user,
        token: signToken({
          userId: user.id_usuario,
          credentialVersion: sessionVersion(user),
        }),
      });
      const category = await prisma.categorias.findFirstOrThrow({
        where: { id_usuario: user.id_usuario },
      });
      await prisma.transacoes.create({
        data: {
          id_usuario: user.id_usuario,
          id_categoria: category.id_categoria,
          valor: 100,
          tipo: "receita",
          descricao: "Fixture de perfil",
          data_transacao: new Date("2026-10-20T00:00:00Z"),
          status: "confirmada",
        },
      });
      await prisma.metas_financeiras.create({
        data: {
          id_usuario: user.id_usuario,
          titulo: "Fixture de perfil",
          valor_objetivo: 1000,
        },
      });
    }
    const [owner, other, race, google] = users;
    assert.ok(owner && other && race && google);

    await t.test(
      "salva nome, avatar e capa no servidor, sem permitir alteração de e-mail ou dono",
      async () => {
        assert.equal((await request("GET", "/users/me")).status, 401);
        const current = await request("GET", "/users/me", owner.token);
        assert.equal(current.status, 200);
        assert.equal(current.data.tem_senha, true);
        assert.equal("senha" in current.data, false);
        for (const input of [
          { email: other.email },
          { id_usuario: other.id_usuario },
          { avatar: "data:image/svg+xml;base64,PHN2Zy8+" },
        ])
          assert.equal(
            (
              await request("PATCH", "/users/me", owner.token, {
                fullName: "Nome Atualizado",
                ...input,
              })
            ).status,
            400,
          );
        const saved = await request("PATCH", "/users/me", owner.token, {
          fullName: "  Matheus   Nome Composto  ",
          avatar: png,
          cover: png,
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.data.nome, "Matheus");
        assert.equal(saved.data.sobrenome, "Nome Composto");
        assert.equal(saved.data.email, owner.email);
        const next = await request("PATCH", "/users/me", owner.token, {
          fullName: "Nome Final",
        });
        assert.equal(next.status, 200);
        assert.equal(next.data.foto_perfil, png);
        assert.equal(next.data.capa_perfil, png);
        const persisted = await request("GET", "/users/me", owner.token);
        assert.equal(persisted.data.nome, "Nome");
        assert.equal(persisted.data.sobrenome, "Final");
        assert.equal(persisted.data.foto_perfil, png);
        const login = await request("POST", "/auth/login", undefined, {
          email: owner.email,
          password,
        });
        assert.equal(login.status, 200);
        assert.equal(login.data.user.foto_perfil, png);
        assert.equal(login.data.user.capa_perfil, png);
        assert.equal(
          (await request("GET", "/users/me", other.token)).data.nome,
          "Perfil",
        );
        const removed = await request("PATCH", "/users/me", owner.token, {
          fullName: "Nome Final",
          avatar: null,
          cover: null,
        });
        assert.equal(removed.data.foto_perfil, null);
        assert.equal(removed.data.capa_perfil, null);
      },
    );

    await t.test(
      "senha incorreta e corpo inválido preservam conta, sessão e registros",
      async () => {
        assert.equal(
          (
            await request("DELETE", "/users/me", owner.token, {
              password: "incorreta",
            })
          ).status,
          403,
        );
        assert.equal(
          (await request("DELETE", "/users/me", owner.token, { password: "" }))
            .status,
          400,
        );
        assert.equal(
          (
            await request("DELETE", "/users/me", owner.token, {
              password,
              id_usuario: other.id_usuario,
            })
          ).status,
          400,
        );
        assert.equal(
          (await request("GET", "/users/me", owner.token)).status,
          200,
        );
        assert.equal(
          await prisma.transacoes.count({
            where: { id_usuario: owner.id_usuario },
          }),
          1,
        );
      },
    );

    await t.test(
      "credencial alterada durante a confirmação impede exclusão e preserva os dados",
      async () => {
        const originalDelete = userRepository.deleteIfCurrent;
        const changed = await hashPassword("NovaSenhaDuranteConfirmacao!123");
        const deletion = mock.method(
          userRepository,
          "deleteIfCurrent",
          async (
            current: Parameters<typeof userRepository.deleteIfCurrent>[0],
          ) => {
            await prisma.usuarios.update({
              where: { id_usuario: current.id_usuario },
              data: { senha: changed },
            });
            return originalDelete(current);
          },
        );
        try {
          assert.equal(
            (await request("DELETE", "/users/me", race.token, { password }))
              .status,
            409,
          );
        } finally {
          deletion.mock.restore();
        }
        assert.equal(
          await prisma.usuarios.count({
            where: { id_usuario: race.id_usuario },
          }),
          1,
        );
        assert.equal(
          await prisma.transacoes.count({
            where: { id_usuario: race.id_usuario },
          }),
          1,
        );
        assert.equal(
          await prisma.categorias.count({
            where: { id_usuario: race.id_usuario },
          }),
          1,
        );
      },
    );

    await t.test(
      "exclusão com senha remove os dados associados e invalida a sessão, sem afetar outra conta",
      async () => {
        assert.equal(
          (await request("DELETE", "/users/me", owner.token, { password }))
            .status,
          200,
        );
        assert.deepEqual(
          await Promise.all([
            prisma.usuarios.count({ where: { id_usuario: owner.id_usuario } }),
            prisma.transacoes.count({
              where: { id_usuario: owner.id_usuario },
            }),
            prisma.categorias.count({
              where: { id_usuario: owner.id_usuario },
            }),
            prisma.metas_financeiras.count({
              where: { id_usuario: owner.id_usuario },
            }),
          ]),
          [0, 0, 0, 0],
        );
        assert.equal(
          (await request("GET", "/users/me", owner.token)).status,
          401,
        );
        assert.equal(
          (await request("GET", "/users/me", other.token)).status,
          200,
        );
        assert.equal(
          await prisma.transacoes.count({
            where: { id_usuario: other.id_usuario },
          }),
          1,
        );
      },
    );

    await t.test(
      "Google exige prova da conta correta e nonce da confirmação antes de excluir",
      async () => {
        env.GOOGLE_CLIENT_ID = "profile-google-client-test";
        const challenge = await request(
          "POST",
          "/users/me/deletion-challenge",
          google.token,
          {},
        );
        assert.equal(challenge.status, 200);
        let payload: TokenPayload & { nonce: string } = {
          iss: "https://accounts.google.com",
          aud: env.GOOGLE_CLIENT_ID,
          sub: google.google_id!,
          email: google.email,
          email_verified: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          nonce: "wrong-nonce",
        };
        const verifier = mock.method(
          OAuth2Client.prototype,
          "verifyIdToken",
          async () => new LoginTicket(undefined, payload),
        );
        try {
          assert.equal(
            (await request("DELETE", "/users/me", google.token, { password }))
              .status,
            403,
          );
          const proof = {
            googleIdToken: "google-fixture",
            challengeToken: challenge.data.challengeToken,
          };
          assert.equal(
            (await request("DELETE", "/users/me", google.token, proof)).status,
            403,
          );
          payload = {
            ...payload,
            nonce: challenge.data.nonce,
            sub: "another-google-user",
          };
          assert.equal(
            (await request("DELETE", "/users/me", google.token, proof)).status,
            403,
          );
          payload = { ...payload, sub: google.google_id! };
          assert.equal(
            (await request("DELETE", "/users/me", google.token, proof)).status,
            200,
          );
          assert.equal(
            (await request("GET", "/users/me", google.token)).status,
            401,
          );
        } finally {
          verifier.mock.restore();
        }
      },
    );
  } finally {
    env.GOOGLE_CLIENT_ID = originalGoogleId;
    await prisma.transacoes.deleteMany({ where: { id_usuario: { in: ids } } });
    await prisma.metas_financeiras.deleteMany({
      where: { id_usuario: { in: ids } },
    });
    await prisma.categorias.deleteMany({ where: { id_usuario: { in: ids } } });
    await prisma.usuarios.deleteMany({ where: { id_usuario: { in: ids } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
