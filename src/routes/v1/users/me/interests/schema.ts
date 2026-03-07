import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const InterestIdParamSchema = v.object({
    id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const CreateInterestSchema = v.object({
    interest: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
    isPrimary: v.optional(v.boolean()),
});

export const UpdateInterestSchema = v.partial(
    v.object({
        interest: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
        isPrimary: v.boolean(),
        isEnabled: v.boolean(),
    }),
);

export const INTEREST_UPDATABLE_FIELDS = new Set(["interest", "isPrimary", "isEnabled"]);

const InterestRecordSchema = v.object({
    id: v.number(),
    interest: v.string(),
    isPrimary: v.boolean(),
    isEnabled: v.boolean(),
    createdAt: v.string(),
});

export const listInterestsDocs = describeRoute({
    tags: ["Profile"],
    summary: "List My Interests",
    security: [{ bearerAuth: [] }],
    description: "Returns all interests for the authenticated user.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(InterestRecordSchema) })) } },
        },
    },
});

export const createInterestDocs = describeRoute({
    tags: ["Profile"],
    summary: "Add Interest",
    security: [{ bearerAuth: [] }],
    description: "Adds a new interest for the authenticated user.",
    responses: {
        201: {
            description: "Created",
            content: { "application/json": { schema: resolver(v.object({ data: InterestRecordSchema })) } },
        },
    },
});

export const updateInterestDocs = describeRoute({
    tags: ["Profile"],
    summary: "Update Interest",
    security: [{ bearerAuth: [] }],
    description: "Partially updates an interest.",
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: InterestRecordSchema })) } },
        },
        400: { description: "No valid fields to update" },
        404: { description: "Interest not found" },
    },
});

export const deleteInterestDocs = describeRoute({
    tags: ["Profile"],
    summary: "Remove Interest",
    security: [{ bearerAuth: [] }],
    description: "Removes an interest.",
    responses: {
        204: { description: "Removed" },
        404: { description: "Interest not found" },
    },
});