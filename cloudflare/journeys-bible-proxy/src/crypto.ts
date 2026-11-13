const encoder = new TextEncoder();

/**
 * Compare two secret strings in constant time by hashing both first.
 * An unset or empty expected value never matches.
 */
export async function secretsEqual(
  provided: string,
  expected: string,
): Promise<boolean> {
  if (expected.length === 0 || provided.length === 0) {
    return false;
  }
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

/** HMAC-SHA256 of value, keyed by secret, truncated to hex. */
export async function hmacSha256Hex(
  secret: string,
  value: string,
  truncateBytes = 16,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .slice(0, truncateBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
