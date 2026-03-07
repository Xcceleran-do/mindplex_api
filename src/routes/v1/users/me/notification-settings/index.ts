import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userNotificationSettings } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    UpdateNotificationSettingsSchema,
    NOTIFICATION_UPDATABLE_FIELDS,
    getNotificationSettingsDocs,
    updateNotificationSettingsDocs,
} from "./schema";

const app = new Hono<AppContext>();

// GET /me/notification-settings
app.get("/", guard("user"), getNotificationSettingsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const settings = await db.query.userNotificationSettings.findFirst({
        where: { userId },
    });

    return c.json({ data: settings });
});

// PATCH /me/notification-settings
app.patch(
    "/",
    guard("user"),
    updateNotificationSettingsDocs,
    validator("json", UpdateNotificationSettingsSchema),
    async (c) => {
        const db = c.get("db");
        const userId = c.get("userId")!;
        const body = c.req.valid("json");

        const sanitized = sanitizeUpdates(body, NOTIFICATION_UPDATABLE_FIELDS);
        if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

        const [updated] = await db
            .update(userNotificationSettings)
            .set(sanitized)
            .where(eq(userNotificationSettings.userId, userId))
            .returning();

        return c.json({ data: updated });
    },
);

export default app;