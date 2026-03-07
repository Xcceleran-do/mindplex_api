import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const FriendRequestIdParamSchema = v.object({
    id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const RespondFriendRequestSchema = v.object({
    status: v.union([v.literal("accepted"), v.literal("rejected")]),
});

const FriendRequestRecordSchema = v.object({
    id: v.number(),
    status: v.string(),
    createdAt: v.string(),
    decidedAt: v.optional(v.nullable(v.string())),
});

export const listReceivedFriendRequestsDocs = describeRoute({
    tags: ["Social"],
    summary: "List Received Friend Requests",
    security: [{ bearerAuth: [] }],
    description: "Returns friend requests received by the authenticated user.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(FriendRequestRecordSchema) })) } },
        },
    },
});

export const listSentFriendRequestsDocs = describeRoute({
    tags: ["Social"],
    summary: "List Sent Friend Requests",
    security: [{ bearerAuth: [] }],
    description: "Returns friend requests sent by the authenticated user.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(FriendRequestRecordSchema) })) } },
        },
    },
});

export const respondFriendRequestDocs = describeRoute({
    tags: ["Social"],
    summary: "Respond to Friend Request",
    security: [{ bearerAuth: [] }],
    description: "Accepts or rejects a pending friend request.",
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: FriendRequestRecordSchema })) } },
        },
        400: { description: "Request already decided" },
        404: { description: "Friend request not found" },
    },
});

export const cancelFriendRequestDocs = describeRoute({
    tags: ["Social"],
    summary: "Cancel Sent Friend Request",
    security: [{ bearerAuth: [] }],
    description: "Cancels a pending friend request the authenticated user has sent.",
    responses: {
        204: { description: "Cancelled" },
        404: { description: "Friend request not found" },
    },
});