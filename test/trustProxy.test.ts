import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { trustProxySchema, type TrustProxy } from "../src/config/trustProxy.js";

test("proxy fica desabilitado por padrão e aceita apenas configuração explícita", () => {
  for (const value of [undefined, "", "   ", "false", "0"]) assert.equal(trustProxySchema.parse(value), false);
  assert.equal(trustProxySchema.parse("2"), 2);
  assert.deepEqual(trustProxySchema.parse("127.0.0.1, 10.0.0.0/8, ::1/128, 2001:db8::/32"), ["127.0.0.1", "10.0.0.0/8", "::1/128", "2001:db8::/32"]);
  for (const value of ["true", "*", "0.0.0.0/0", "::/0", "::ffff:0:0/96", "0:0:0:0:0:ffff:0:0/96", "1.5", "-1", "1e2", "99999999999999999", "1,2", "localhost", "127.0.0.1,", "10.0.0.0/33", "::1/129", "127.0.0.1/", "::1%lo", "10.0.0.0/8/1"]) {
    assert.equal(trustProxySchema.safeParse(value).success, false, value);
  }
  assert.deepEqual(app.get("trust proxy"), env.TRUST_PROXY);
});

async function withProxy(setting: TrustProxy, run: (login: (forwardedFor: string) => Promise<number>) => Promise<void>) {
  const previous = app.get("trust proxy");
  app.set("trust proxy", setting);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await run(async (forwardedFor) => {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
        body: "{}", // Validation fails before any database access.
      });
      await response.body?.cancel();
      return response.status;
    });
  } finally {
    server.closeIdleConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    app.set("trust proxy", previous);
  }
}

test("limite por IP respeita um salto e não usa endereços forjados à esquerda", async () => {
  await withProxy(trustProxySchema.parse("1"), async (login) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      assert.equal(await login(`192.0.2.${attempt + 1}, 198.51.100.7`), 400);
    }
    assert.equal(await login("192.0.2.99, 198.51.100.7"), 429);
    assert.equal(await login("192.0.2.99, 198.51.100.8"), 400, "Outro cliente preserva seu limite.");
  });
});

test("lista de proxies confiáveis separa clientes e para no primeiro IP não confiável", async () => {
  await withProxy(trustProxySchema.parse("127.0.0.1/32,::1/128"), async (login) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      assert.equal(await login(`192.0.2.${attempt + 1}, 203.0.113.20`), 400);
    }
    assert.equal(await login("192.0.2.99, 203.0.113.20"), 429);
    assert.equal(await login("192.0.2.99, 203.0.113.21"), 400);
  });
});

test("origem fora das redes confiáveis não consegue trocar o IP pelo cabeçalho", async () => {
  await withProxy(trustProxySchema.parse("198.51.100.0/24"), async (login) => {
    for (let attempt = 0; attempt < 30; attempt++) assert.equal(await login(`203.0.113.${attempt + 1}`), 400);
    assert.equal(await login("192.0.2.100"), 429);
  });
});
