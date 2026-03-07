import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

const PrivacyLevelSchema = v.union([v.literal("public"), v.literal("private"), v.literal("friends")]);
const ThemeSchema = v.union([v.literal("light"), v.literal("dark")]);

export const UpdatePreferencesSchema = v.partial(
    v.object({
        theme: ThemeSchema,
        privacyAge: PrivacyLevelSchema,
        privacyGender: PrivacyLevelSchema,
        privacyEducation: PrivacyLevelSchema,
    }),
);

export const PREFERENCES_UPDATABLE_FIELDS = new Set(["theme", "privacyAge", "privacyGender", "privacyEducation"]);

const PreferencesResponseSchema = v.object({
    userId: v.number(),
    theme: v.nullable(v.string()),
    privacyAge: v.nullable(v.string()),
    privacyGender: v.nullable(v.string()),
    privacyEducation: v.nullable(v.string()),
});

export const getPreferencesDocs = describeRoute({
    tags: ["Account"],
    summary: "Get My Preferences",
    security: [{ bearerAuth: [] }],
    description: "Returns the authenticated user's preferences.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: PreferencesResponseSchema })) } },
        },
    },
});

export const updatePreferencesDocs = describeRoute({
    tags: ["Account"],
    summary: "Update My Preferences",
    security: [{ bearerAuth: [] }],
    description: "Partially updates the authenticated user's preferences.",
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: PreferencesResponseSchema })) } },
        },
        400: { description: "No valid fields to update" },
    },
});