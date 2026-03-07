import * as v from "valibot";
import { describeRoute, resolver } from "hono-openapi";

export const EducationIdParamSchema = v.object({
    id: v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1)),
});

export const CreateEducationSchema = v.object({
    educationalBackground: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
});

export const UpdateEducationSchema = v.partial(
    v.object({
        educationalBackground: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
        isEnabled: v.boolean(),
    }),
);

export const EDUCATION_UPDATABLE_FIELDS = new Set(["educationalBackground", "isEnabled"]);

const EducationRecordSchema = v.object({
    id: v.number(),
    educationalBackground: v.string(),
    isEnabled: v.boolean(),
    createdAt: v.string(),
});

export const listEducationDocs = describeRoute({
    tags: ["Profile"],
    summary: "List My Education",
    security: [{ bearerAuth: [] }],
    description: "Returns all education entries for the authenticated user.",
    responses: {
        200: {
            description: "OK",
            content: { "application/json": { schema: resolver(v.object({ data: v.array(EducationRecordSchema) })) } },
        },
    },
});

export const createEducationDocs = describeRoute({
    tags: ["Profile"],
    summary: "Add Education",
    security: [{ bearerAuth: [] }],
    description: "Adds an education entry for the authenticated user.",
    responses: {
        201: {
            description: "Created",
            content: { "application/json": { schema: resolver(v.object({ data: EducationRecordSchema })) } },
        },
    },
});

export const updateEducationDocs = describeRoute({
    tags: ["Profile"],
    summary: "Update Education",
    security: [{ bearerAuth: [] }],
    description: "Partially updates an education entry.",
    responses: {
        200: {
            description: "Updated",
            content: { "application/json": { schema: resolver(v.object({ data: EducationRecordSchema })) } },
        },
        400: { description: "No valid fields to update" },
        404: { description: "Education entry not found" },
    },
});

export const deleteEducationDocs = describeRoute({
    tags: ["Profile"],
    summary: "Remove Education",
    security: [{ bearerAuth: [] }],
    description: "Removes an education entry.",
    responses: {
        204: { description: "Removed" },
        404: { description: "Education entry not found" },
    },
});