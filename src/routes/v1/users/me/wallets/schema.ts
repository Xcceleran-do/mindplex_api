import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const WalletIdParamSchema = v.object({
    id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const CreateWalletSchema = v.object({
    publicAddress: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
});

export const UpdateWalletSchema = v.partial(
    v.object({
        paymentAddress: v.pipe(v.string(), v.maxLength(100)),
    }),
);

export const WALLET_UPDATABLE_FIELDS = new Set(["paymentAddress"]);

const WalletRecordSchema = v.object({
    id: v.number(),
    publicAddress: v.nullable(v.string()),
    isVerified: v.boolean(),
    paymentAddress: v.nullable(v.string()),
    isPaymentVerified: v.boolean(),
    createdAt: v.string(),
});

export const listWalletsDocs = describeRoute({
    tags: ["Account"],
    summary: "List My Wallets",
    security: [{ bearerAuth: [] }],
    description: "Returns all wallets linked to the authenticated user.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(WalletRecordSchema) })) } },
        },
    },
});

export const createWalletDocs = describeRoute({
    tags: ["Account"],
    summary: "Connect Wallet",
    security: [{ bearerAuth: [] }],
    description: "Connects a new wallet to the authenticated user's account.",
    responses: {
        201: {
            description: "Created",
            content: { "application/json": { schema: resolver(v.object({ data: WalletRecordSchema })) } },
        },
        409: { description: "Wallet already connected" },
    },
});

export const updateWalletDocs = describeRoute({
    tags: ["Account"],
    summary: "Update Wallet",
    security: [{ bearerAuth: [] }],
    description: "Updates a wallet (e.g., set payment address).",
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: WalletRecordSchema })) } },
        },
        400: { description: "No valid fields to update" },
        404: { description: "Wallet not found" },
    },
});

export const deleteWalletDocs = describeRoute({
    tags: ["Account"],
    summary: "Disconnect Wallet",
    security: [{ bearerAuth: [] }],
    description: "Disconnects a wallet from the authenticated user's account.",
    responses: {
        204: { description: "Disconnected" },
        404: { description: "Wallet not found" },
    },
});

export const verifyWalletDocs = describeRoute({
    tags: ["Account"],
    summary: "Verify Wallet Ownership",
    security: [{ bearerAuth: [] }],
    description: "Initiates ownership verification for a wallet. (Verification logic TBD.)",
    responses: {
        200: { description: "Verification initiated" },
        404: { description: "Wallet not found" },
    },
});

export const verifyPaymentDocs = describeRoute({
    tags: ["Account"],
    summary: "Verify Payment Address",
    security: [{ bearerAuth: [] }],
    description: "Verifies the payment address for a wallet. (Verification logic TBD.)",
    responses: {
        200: { description: "Verification initiated" },
        404: { description: "Wallet not found" },
    },
});