import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userProfiles } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    UpdateProfileSchema,
    PROFILE_UPDATABLE_FIELDS,
    getProfileDocs,
    updateProfileDocs,
    getAccountDocs,
} from "./schema";

import preferences from "./preferences";
import notificationSettings from "./notification-settings";
import socialAuths from "./social-auths";
import interests from "./interests";
import education from "./education";
import wallets from "./wallets";
import friendRequests from "./friend-requests";

const me = new Hono<AppContext>();

// GET /me
me.get("/", guard("user"), getAccountDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const user = await db.query.users.findFirst({
        where: { id: userId },
        columns: { id: true, username: true, email: true, role: true, isActivated: true, createdAt: true },
    });

    if (!user) return c.json({ error: "User not found" }, 404);

    return c.json({ data: user });
});


// GET /me/profile
me.get("/profile", guard("user"), getProfileDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const profile = await db.query.userProfiles.findFirst({
        where: { userId },
    });

    if (!profile) return c.json({ error: "Profile not found" }, 404);

    return c.json({ data: profile });
});

// PATCH /me/profile
me.patch("/profile", guard("user"), updateProfileDocs, validator("json", UpdateProfileSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    const sanitized = sanitizeUpdates(body, PROFILE_UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    const [updated] = await db
        .update(userProfiles)
        .set(sanitized)
        .where(eq(userProfiles.userId, userId))
        .returning();

    if (!updated) return c.json({ error: "Profile not found" }, 404);

    return c.json({ data: updated });
});


me.route("/preferences", preferences);
me.route("/notification-settings", notificationSettings);
me.route("/social-auths", socialAuths);
me.route("/interests", interests);
me.route("/education", education);
me.route("/wallets", wallets);
me.route("/friend-requests", friendRequests);

export default me;