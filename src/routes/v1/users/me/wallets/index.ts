import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext } from "$src/types";
import { guard } from "$src/middleware/auth";
import { userWallets } from "$src/db/schema";
import { sanitizeUpdates } from "$src/utils";
import {
    WalletIdParamSchema,
    CreateWalletSchema,
    UpdateWalletSchema,
    WALLET_UPDATABLE_FIELDS,
    listWalletsDocs,
    createWalletDocs,
    updateWalletDocs,
    deleteWalletDocs,
    verifyWalletDocs,
    verifyPaymentDocs,
} from "./schema";

const app = new Hono<AppContext>();

// GET /me/wallets
app.get("/", guard("user"), listWalletsDocs, async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;

    const data = await db.query.userWallets.findMany({
        where: { userId },
    });

    return c.json({ data });
});

// POST /me/wallets
app.post("/", guard("user"), createWalletDocs, validator("json", CreateWalletSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    try {
        const [created] = await db
            .insert(userWallets)
            .values({
                userId,
                publicAddress: body.publicAddress,
            })
            .returning();

        return c.json({ data: created }, 201);
    } catch (error: any) {

        const isUnique =
            error?.code === "23505" ||
            error?.cause?.code === "23505" ||
            error?.cause?.cause?.code === "23505" ||
            error?.message?.includes("23505") ||
            error?.message?.includes("unique constraint");
        if (isUnique) {
            return c.json({ error: "Wallet already connected" }, 409);
        }
        throw error;
    }
});

// PATCH /me/wallets/:id
app.patch("/:id", guard("user"), updateWalletDocs, validator("param", WalletIdParamSchema), validator("json", UpdateWalletSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const sanitized = sanitizeUpdates(body, WALLET_UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    const [updated] = await db
        .update(userWallets)
        .set(sanitized)
        .where(and(eq(userWallets.id, id), eq(userWallets.userId, userId)))
        .returning();

    if (!updated) return c.json({ error: "Wallet not found" }, 404);

    return c.json({ data: updated });
});

// DELETE /me/wallets/:id
app.delete("/:id", guard("user"), deleteWalletDocs, validator("param", WalletIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const deleted = await db
        .delete(userWallets)
        .where(and(eq(userWallets.id, id), eq(userWallets.userId, userId)))
        .returning();

    if (deleted.length === 0) return c.json({ error: "Wallet not found" }, 404);

    return c.body(null, 204);
});

// POST /me/wallets/:id/verify
app.post("/:id/verify", guard("user"), verifyWalletDocs, validator("param", WalletIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const wallet = await db.query.userWallets.findFirst({
        where: { id, userId },
        columns: { id: true },
    });

    if (!wallet) return c.json({ error: "Wallet not found" }, 404);

    // TODO: Implement actual wallet ownership verification (signature challenge)
    return c.json({ message: "Verification not yet implemented" });
});

// POST /me/wallets/:id/verify-payment
app.post("/:id/verify-payment", guard("user"), verifyPaymentDocs, validator("param", WalletIdParamSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { id } = c.req.valid("param");

    const wallet = await db.query.userWallets.findFirst({
        where: { id, userId },
        columns: { id: true },
    });

    if (!wallet) return c.json({ error: "Wallet not found" }, 404);

    // TODO: Implement actual payment address verification
    return c.json({ message: "Payment verification not yet implemented" });
});

export default app;