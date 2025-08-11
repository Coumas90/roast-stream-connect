export type CipherBundle = { iv: string; tag: string; data: string };

export const hexToBytes = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
export const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function kmsFromHex(hex: string) {
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("kms_misconfigured");
  return hexToBytes(hex.trim());
}

export async function decryptAESGCM(keyHex: string, bundle: CipherBundle): Promise<unknown> {
  const keyRaw = kmsFromHex(keyHex);
  const cryptoKey = await crypto.subtle.importKey("raw", keyRaw, "AES-GCM", false, ["decrypt"]);
  const iv = fromB64(bundle.iv);
  const body = fromB64(bundle.data);
  const tag = fromB64(bundle.tag);
  const ct = new Uint8Array(body.length + tag.length);
  ct.set(body);
  ct.set(tag, body.length);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ct);
  const json = new TextDecoder().decode(pt);
  return JSON.parse(json);
}
