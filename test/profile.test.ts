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
