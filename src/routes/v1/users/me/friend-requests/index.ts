import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { friendRequests } from "$src/db/schema";
import {
    FriendRequestIdParamSchema,
    RespondFriendRequestSchema,
    listReceivedFriendRequestsDocs,
    listSentFriendRequestsDocs,
    respondFriendRequestDocs,
    cancelFriendRequestDocs,
} from "./schema";

const app = new Hono<AppContext>();

// GET /me/friend-requests — received
app.get("/", guard("user"), listReceivedFriendRequestsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.friendRequests.findMany({
        where: { requestedId: userId },
        with: {
            requester: { columns: { id: true, username: true } },
        },
    });

    return c.json({ data });
});

// GET /me/friend-requests/sent
app.get("/sent", guard("user"), listSentFriendRequestsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.friendRequests.findMany({
        where: { requesterId: userId },
        with: {
            requested: { columns: { id: true, username: true } },
        },
    });

    return c.json({ data });
});

// PATCH /me/friend-requests/:id — accept or reject
app.patch(
    "/:id",
    guard("user"),
    respondFriendRequestDocs,
    validator("param", FriendRequestIdParamSchema),
    validator("json", RespondFriendRequestSchema),
    async (c) => {
        const db = c.get("db");
        const userId = c.get("userId")!;
        const { id } = c.req.valid("param");
        const { status } = c.req.valid("json");

        const request = await db.query.friendRequests.findFirst({
            where: { id, requestedId: userId },
        });


        if (!request) return c.json({ error: "Friend request not found" }, 404);
        if (request.status !== "pending") return c.json({ error: "Friend request already decided" }, 400);

        const [updated] = await db
            .update(friendRequests)
            .set({ status, decidedAt: new Date() })
            .where(eq(friendRequests.id, id))
            .returning();

        return c.json({ data: updated });
    },
);

// DELETE /me/friend-requests/:id — cancel sent request
app.delete("/:id", guard("user"), cancelFriendRequestDocs, validator("param", FriendRequestIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const deleted = await db
        .delete(friendRequests)
        .where(and(eq(friendRequests.id, id), eq(friendRequests.requesterId, userId)))
        .returning();

    if (deleted.length === 0) return c.json({ error: "Friend request not found" }, 404);

    return c.body(null, 204);
});

export default app;