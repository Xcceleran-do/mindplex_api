import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const UpdateNotificationSettingsSchema = v.partial(
    v.object({
        notifyPublications: v.boolean(),
        notifyFollower: v.boolean(),
        notifyInteraction: v.boolean(),
        notifyWeekly: v.boolean(),
        notifyUpdates: v.boolean(),
    }),
);

export const NOTIFICATION_UPDATABLE_FIELDS = new Set([
    "notifyPublications",
    "notifyFollower",
    "notifyInteraction",
    "notifyWeekly",
    "notifyUpdates",
]);

const NotificationSettingsResponseSchema = v.object({
    userId: v.number(),
    notifyPublications: v.nullable(v.boolean()),
    notifyFollower: v.nullable(v.boolean()),
    notifyInteraction: v.nullable(v.boolean()),
    notifyWeekly: v.nullable(v.boolean()),
    notifyUpdates: v.nullable(v.boolean()),
});

export const getNotificationSettingsDocs = describeRoute({
    tags: ["Account"],
    summary: "Get My Notification Settings",
    security: [{ bearerAuth: [] }],
    description: "Returns the authenticated user's notification settings.",
    responses: {
        200: {
            description: "OK",
            content: {
                "application/json": { schema: resolver(v.object({ data: NotificationSettingsResponseSchema })) },
            },
        },
    },
});

export const updateNotificationSettingsDocs = describeRoute({
    tags: ["Account"],
    summary: "Update My Notification Settings",
    security: [{ bearerAuth: [] }],
    description: "Partially updates the authenticated user's notification settings.",
    responses: {
        200: {
            description: "Updated",
            content: {
                "application/json": { schema: resolver(v.object({ data: NotificationSettingsResponseSchema })) },
            },
        },
        400: { description: "No valid fields to update" },
    },
});