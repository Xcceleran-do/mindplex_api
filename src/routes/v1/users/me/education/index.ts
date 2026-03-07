import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userEducation } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    EducationIdParamSchema,
    CreateEducationSchema,
    UpdateEducationSchema,
    EDUCATION_UPDATABLE_FIELDS,
    listEducationDocs,
    createEducationDocs,
    updateEducationDocs,
    deleteEducationDocs,
} from "./schema";

const app = new Hono<AppContext>();

// GET /me/education
app.get("/", guard("user"), listEducationDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.userEducation.findMany({
        where: { userId },
    });

    return c.json({ data });
});

// POST /me/education
app.post("/", guard("user"), createEducationDocs, validator("json", CreateEducationSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    const [created] = await db
        .insert(userEducation)
        .values({
            userId,
            educationalBackground: body.educationalBackground,
        })
        .returning();

    return c.json({ data: created }, 201);
});

// PATCH /me/education/:id
app.patch("/:id", guard("user"), updateEducationDocs, validator("param", EducationIdParamSchema), validator("json", UpdateEducationSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const sanitized = sanitizeUpdates(body, EDUCATION_UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    const [updated] = await db
        .update(userEducation)
        .set(sanitized)
        .where(and(eq(userEducation.id, id), eq(userEducation.userId, userId)))
        .returning();

    if (!updated) return c.json({ error: "Education entry not found" }, 404);

    return c.json({ data: updated });
});

// DELETE /me/education/:id
app.delete("/:id", guard("user"), deleteEducationDocs, validator("param", EducationIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const deleted = await db
        .delete(userEducation)
        .where(and(eq(userEducation.id, id), eq(userEducation.userId, userId)))
        .returning();

    if (deleted.length === 0) return c.json({ error: "Education entry not found" }, 404);

    return c.body(null, 204);
});

export default app;