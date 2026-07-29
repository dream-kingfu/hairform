function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("invalid_hex");
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createPasswordHash(password: string, iterations = 100_000) {
  const salt = new Uint8Array(18); crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
  return `pbkdf2_sha256_hex:${iterations}:${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export async function verifyPasswordHash(password: string, encoded?: string) {
  const safeEncoded = encoded || "pbkdf2_sha256_hex:100000:000000000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";
  const separator = safeEncoded.includes(":") ? ":" : "$";
  const [algorithm, iterationsText, saltText, expectedText] = safeEncoded.split(separator);
  if (!["pbkdf2_sha256", "pbkdf2_sha256_hex"].includes(algorithm) || !iterationsText || !saltText || !expectedText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations !== 100_000) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const decode = algorithm === "pbkdf2_sha256_hex" ? hexToBytes : base64ToBytes;
    const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: decode(saltText), iterations }, key, 256));
    return Boolean(encoded) && secureEqual(actual, decode(expectedText));
  } catch { return false; }
}
