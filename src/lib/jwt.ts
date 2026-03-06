import { Role } from "$src/db/schema";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "$env";
import { randomBytes, createHash, createHmac } from "node:crypto";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

const ALG = "HS256";

export interface UserJwtPayload extends JWTPayload {
  email: string;
  role: Role;
  sessionId: string;
}

/**
 * Generates a new HS256-signed JWT access token.
 *
 * The token includes the user's email, role, and a session ID (familyId).
 * It is valid for 15 minutes and signed with the JWT_SECRET.
 */
export async function generateAccessToken(payload: UserJwtPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer("mindplex")
    .setAudience("mindplex-api")
    .setExpirationTime("15m")
    .sign(JWT_SECRET);
}

/**
 * Verifies an HS256-signed JWT access token.
 *
 * Checks the token's signature, issuer, audience, and expiration.
 * Throws an error if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<UserJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "mindplex",
      audience: "mindplex-api",
    });
    return payload as UserJwtPayload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Generates a random opaque token pair.
 *
 * Returns both a raw hex token (for the client) and a SHA256-hashed version (for storage).
 */
export function generateOpaqueToken() {
  const rawToken = randomBytes(40).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, hashedToken };
}

/**
 * Computes the SHA256 hash of a raw token string.
 *
 * Used to create a consistent, one-way representation of a token for storage or comparison.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** PHPass encoding alphabet — used to encode the MD5 output into a string. */
const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Verifies a password against a PHPass portable hash ($P$ or $H$).
 *
 * Hash structure: $P$B{salt:8}{hash:22}
 *   - Index 3 ('B') = iteration count as log2 index into ITOA64 (B = 13 → 2^13 = 8192)
 *   - Next 8 chars = salt
 *   - Remaining 22 chars = the encoded hash to compare against
 */
function verifyPhpass(password: string, storedHash: string): boolean {
  const iterCount = 1 << ITOA64.indexOf(storedHash[3]);
  const salt = storedHash.substring(4, 12);

  let hash = createHash("md5")
    .update(salt + password)
    .digest();
  for (let i = 0; i < iterCount; i++) {
    hash = createHash("md5")
      .update(Buffer.concat([hash, Buffer.from(password)]))
      .digest();
  }

  // encode the hash the same way PHPass does
  let encoded = "";
  let i = 0;
  while (i < 16) {
    let value = hash[i++];
    encoded += ITOA64[value & 0x3f];
    if (i < 16) value |= hash[i] << 8;
    encoded += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= 16) break;
    if (i < 16) value |= hash[i] << 16;
    encoded += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= 16) break;
    encoded += ITOA64[(value >> 18) & 0x3f];
  }

  return encoded === storedHash.substring(12);
}
/**
 * Verifies a plaintext password against any WordPress hash format.
 *
 * $wp$2y$ → Strip the $wp prefix, pre-hash with HMAC-SHA384 (key: 'wp-sha384'),
 *           base64 encode it, then verify against the bcrypt hash with Bun.
 * $P$ / $H$ → Run through the PHPass iterated MD5 verification above.
 */
export async function verifyWordpressPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("$wp")) {
    const hash = storedHash.replace("$wp", "");
    const preHashed = createHmac("sha384", "wp-sha384").update(password.trim()).digest("base64");
    const isValid = await Bun.password.verify(preHashed, hash);
    return isValid;
  }

  if (storedHash.startsWith("$P$")) {
    let verify = verifyPhpass(password, storedHash);
    return verify;
  }

  return false;
}

/** Returns true if the hash is a WordPress format that needs migration to Argon2id. */
export function isLegacyPassword(storedHash: string) {
  return storedHash.startsWith("$wp") || storedHash.startsWith("$P$");
}
