import { isIP, SocketAddress } from "node:net";
import { z } from "zod";

export type TrustProxy = false | number | string[];

function isProxyAddress(value: string): boolean {
  const [address = "", prefix, ...extra] = value.split("/");
  const version = isIP(address);
  if (!version || address.includes("%") || extra.length) return false;
  if (prefix === undefined) return true;
  if (!/^[1-9]\d*$/.test(prefix)) return false;
  const bits = Number(prefix);
  // A mapped IPv6 /96 is equivalent to trusting every IPv4 address.
  if (version === 6 && bits <= 96 && new SocketAddress({ address, family: "ipv6" }).address.startsWith("::ffff:")) return false;
  return bits <= (version === 4 ? 32 : 128);
}

export const trustProxySchema = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? undefined : value,
  z.string().trim().default("false"),
).transform((value, context): TrustProxy => {
  if (value === "false" || value === "0") return false;
  if (/^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);
  const addresses = value.split(",").map((address) => address.trim());
  if (addresses.every(isProxyAddress)) return addresses;
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Use false, o número de proxies ou uma lista de IPs/CIDRs explícitos. true e redes /0 não são permitidos.",
  });
  return z.NEVER;
});
