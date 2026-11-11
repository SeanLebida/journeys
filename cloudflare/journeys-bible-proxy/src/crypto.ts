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
