import { describe, it, expect } from "vitest";

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toB64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).btoa(s);
}

// Use the same decryptor as the Edge function
import { decryptAESGCM } from "../../supabase/functions/_shared/crypto";

async function encryptAESGCM(keyBytes: Uint8Array, iv: Uint8Array, obj: unknown) {
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, pt));
  const tagLen = 16;
  const body = ct.slice(0, ct.length - tagLen);
  const tag = ct.slice(ct.length - tagLen);
  return { iv: toB64(iv), data: toB64(body), tag: toB64(tag) };
}

describe("AES-GCM crypto helpers", () => {
  it("round-trip encrypt+decrypt returns original object", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const original = { apiKey: "test_123", foo: 42, nested: { ok: true } };
    const bundle = await encryptAESGCM(key, iv, original);

    const out = (await decryptAESGCM(toHex(key), bundle)) as any;
    expect(out).toEqual(original);
  });

  it("wrong key throws", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const bad = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const original = { v: 1 };
    const bundle = await encryptAESGCM(key, iv, original);

    await expect(decryptAESGCM(toHex(bad), bundle)).rejects.toBeTruthy();
  });

  it("invalid IV throws", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(8)); // wrong length
    const original = { v: 2 };

    // We must still produce a bundle to pass types; encryption with wrong IV is not allowed, so simulate by creating bundle with wrong IV on purpose
    const goodIv = crypto.getRandomValues(new Uint8Array(12));
    const bundle = await encryptAESGCM(key, goodIv, original);
    const badBundle = { ...bundle, iv: toB64(iv) };

    await expect(decryptAESGCM(toHex(key), badBundle as any)).rejects.toBeTruthy();
  });
});
