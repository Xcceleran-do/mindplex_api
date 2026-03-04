import { createMiddleware } from 'hono/factory';
import { verifyToken, type UserJwtPayload } from '$src/lib/jwt';
import type { AppContext } from '$src/types';
import { hasRole } from '$src/utils';
import type { Access, Role } from '$src/db/schema/types';
import { ACCESS } from '$src/db/schema/types';
import type { Context } from 'hono';


/**
 * Single auth middleware for every route in the API.
 *
 * ```ts
 * guard()              // admin only (secure default)
 * guard("optional")    // parse token if present, don't fail if missing
 * guard("editor")      // logged-in + minimum Editor role
 * guard("admin")       // logged-in + minimum Admin role
 * guard("collaborator") // logged-in + minimum collaborator
 * ```
 *
 * After `guard()` or `guard(role)`, `c.get('user')` is guaranteed non-null.
 * After `guard("optional")`, `c.get('user')` may be null.
 */
export function guard(mode: "optional" | Access = ACCESS.Admin) {
    return createMiddleware<AppContext>(async (c, next) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        let user: UserJwtPayload | null = null;
        if (token) {
            try {
                user = await verifyToken(token);
            } catch {
                if (mode !== "optional") {
                    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
                }
            }
        }

        if (!user && mode !== "optional") {
            return c.json({ error: 'Unauthorized' }, 401);
        }


        if (user && mode && mode !== "optional") {
            if (!hasRole(user.role as Access, mode as Access)) {
                return c.json({ error: 'Forbidden: Insufficient permissions' }, 403);
            }
        }

        c.set('user', user);
        c.set('userId', user ? Number(user.sub) : null);
        c.set('role', user ? (user.role as Access) : ACCESS.Public);

        return next();
    });
}

/**
 * Is the current user the resource owner, or do they have `minRole`?
 *
 * ```ts
 * if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: 'Forbidden' }, 403);
 * if (!isOwnerOrRole(c, comment.authorId, "moderator")) ...
 * ```
 */
export function isOwnerOrRole(c: Context<AppContext>, ownerId: number, minRole: Access = ACCESS.Admin): boolean {
    const user = c.get('user')
    if (!user) return false;
    if (Number(user.sub) === ownerId) return true;
    return hasRole(user.role as Access, minRole);
}