import { createMiddleware } from 'hono/factory';
import { verifyToken } from '$src/lib/jwt';
import type { AppContext } from '$src/types';

export const requireAuth = createMiddleware<AppContext>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedPayload = await verifyToken(token);

        c.set('user', decodedPayload);

        await next();
    } catch (error) {
        return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
    }
});