import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const ProviderParamSchema = v.object({
    provider: v.union([v.literal("google"), v.literal("github")]),
});

const SocialAuthRecordSchema = v.object({
    id: v.number(),
    provider: v.string(),
    providerId: v.string(),
    createdAt: v.string(),
});

export const listSocialAuthsDocs = describeRoute({
    tags: ["Account"],
    summary: "List Linked Social Providers",
    security: [{ bearerAuth: [] }],
    description: "Returns all social auth providers linked to the authenticated user's account.",
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": { schema: resolver(v.object({ data: v.array(SocialAuthRecordSchema) })) },
            },
        },
    },
});

export const unlinkSocialAuthDocs = describeRoute({
    tags: ["Account"],
    summary: "Unlink Social Provider",
    security: [{ bearerAuth: [] }],
    description: "Removes a linked social auth provider. Cannot unlink if it's the only login method and no password is set.",
    responses: {
        204: { description: "Unlinked" },
        400: { description: "Cannot unlink — no other login method available" },
        404: { description: "Provider not linked" },
    },
});