import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { users, userSocialAuths } from "$src/db/schema";
import { ProviderParamSchema, listSocialAuthsDocs, unlinkSocialAuthDocs } from "./schema";

const app = new Hono<AppContext>();

// GET /me/social-auths
app.get("/", guard("user"), listSocialAuthsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.userSocialAuths.findMany({
        where: { userId },
        columns: { id: true, provider: true, providerId: true, createdAt: true },
    });

    return c.json({ data });
});

// DELETE /me/social-auths/:provider
app.delete("/:provider", guard("user"), unlinkSocialAuthDocs, validator("param", ProviderParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { provider } = c.req.valid("param");

    const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    const linkedProviders = await db.query.userSocialAuths.findMany({
        where: { userId },
        columns: { provider: true },
    });

    const hasPassword = !!user?.passwordHash;
    const otherProviders = linkedProviders.filter((p) => p.provider !== provider);

    if (!hasPassword && otherProviders.length === 0) {
        return c.json({ error: "Cannot unlink — no other login method available. Set a password first." }, 400);
    }

    const deleted = await db
        .delete(userSocialAuths)
        .where(and(eq(userSocialAuths.userId, userId), eq(userSocialAuths.provider, provider)))
        .returning();

    if (deleted.length === 0) return c.json({ error: "Provider not linked" }, 404);

    return c.body(null, 204);
});

export default app;