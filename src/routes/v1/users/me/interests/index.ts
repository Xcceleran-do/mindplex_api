import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userInterests } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    InterestIdParamSchema,
    CreateInterestSchema,
    UpdateInterestSchema,
    INTEREST_UPDATABLE_FIELDS,
    listInterestsDocs,
    createInterestDocs,
    updateInterestDocs,
    deleteInterestDocs,
} from "./schema";

const app = new Hono<AppContext>();

// GET /me/interests
app.get("/", guard("user"), listInterestsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.userInterests.findMany({
        where: { userId },
    });

    return c.json({ data });
});

// POST /me/interests
app.post("/", guard("user"), createInterestDocs, validator("json", CreateInterestSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    const [created] = await db
        .insert(userInterests)
        .values({
            userId,
            interest: body.interest,
            isPrimary: body.isPrimary ?? false,
        })
        .returning();

    return c.json({ data: created }, 201);
});

// PATCH /me/interests/:id
app.patch("/:id", guard("user"), updateInterestDocs, validator("param", InterestIdParamSchema), validator("json", UpdateInterestSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const sanitized = sanitizeUpdates(body, INTEREST_UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    const [updated] = await db
        .update(userInterests)
        .set(sanitized)
        .where(and(eq(userInterests.id, id), eq(userInterests.userId, userId)))
        .returning();

    if (!updated) return c.json({ error: "Interest not found" }, 404);

    return c.json({ data: updated });
});

// DELETE /me/interests/:id
app.delete("/:id", guard("user"), deleteInterestDocs, validator("param", InterestIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const deleted = await db
        .delete(userInterests)
        .where(and(eq(userInterests.id, id), eq(userInterests.userId, userId)))
        .returning();

    if (deleted.length === 0) return c.json({ error: "Interest not found" }, 404);

    return c.body(null, 204);
});

export default app;