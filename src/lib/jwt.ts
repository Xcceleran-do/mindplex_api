import { Role } from '$src/db/schema';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from '$env'
import { randomBytes, createHash } from 'node:crypto'

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

const ALG = 'HS256';

export interface UserJwtPayload extends JWTPayload {
    email: string;
    role: Role,
    sessionId: string
}

export async function generateAccessToken(payload: UserJwtPayload): Promise<string> {
    return await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: ALG })
        .setIssuedAt()
        .setIssuer('mindplex')
        .setAudience('mindplex-api')
        .setExpirationTime('15m')
        .sign(JWT_SECRET);
}


export async function verifyToken(token: string): Promise<UserJwtPayload> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET, {
            issuer: 'mindplex',
            audience: 'mindplex-api',
        });
        return payload as UserJwtPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

export function generateOpaqueToken() {
    const rawToken = randomBytes(40).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    return { rawToken, hashedToken };
}

export function hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}
