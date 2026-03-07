import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userPreferences } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    UpdatePreferencesSchema,
    PREFERENCES_UPDATABLE_FIELDS,
    getPreferencesDocs,
    updatePreferencesDocs,
} from "./schema";

const app = new Hono<AppContext>();

app.get("/", guard("user"), getPreferencesDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const prefs = await db.query.userPreferences.findFirst({
        where: { userId },
    });

    return c.json({ data: prefs });
});

// PATCH /me/preferences
app.patch("/", guard("user"), updatePreferencesDocs, validator("json", UpdatePreferencesSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    const sanitized = sanitizeUpdates(body, PREFERENCES_UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    const [updated] = await db
        .update(userPreferences)
        .set(sanitized)
        .where(eq(userPreferences.userId, userId))
        .returning();

    return c.json({ data: updated });
});

export default app;