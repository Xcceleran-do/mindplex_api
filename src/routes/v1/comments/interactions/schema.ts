import * as v from "valibot";
import { PaginationLimitSchema, PaginationPageSchema } from "$src/lib/validators";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { commentReactions } from "$src/db/schema/socials";
import { describeRoute, resolver } from "hono-openapi";

// ─── Constants ──────────────────────────────────────────────

export const ALLOWED_INCLUDES = ["user"];
export const FORBIDDEN_COLUMNS = new Set<string>(["commentId", "userId"]);

// ─── Query Schemas ──────────────────────────────────────────

export const ReactionListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(commentReactions, FORBIDDEN_COLUMNS),
  include: createIncludesSchema(ALLOWED_INCLUDES),
  reaction: v.optional(v.picklist(["like", "dislike"])),
});

// ─── Body Schemas ───────────────────────────────────────────

export const CreateReactionSchema = v.object({
  reaction: v.picklist(["like", "dislike"]),
});

// ─── Response Schemas ───────────────────────────────────────

const InteractionUserSchema = v.object({
  id: v.number(),
  username: v.string(),
  profile: v.optional(v.nullable(v.object({ avatarUrl: v.nullable(v.string()) }))),
});

const ReactionRecordSchema = v.object({
  id: v.number(),
  reaction: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  user: v.optional(InteractionUserSchema),
});

function paginatedResponse(itemSchema: v.GenericSchema) {
  return v.object({ data: v.array(itemSchema), total: v.number() });
}

const MutationResponseSchema = v.object({
  data: v.object({ id: v.number() }),
});

// ─── OpenAPI Docs ───────────────────────────────────────────

const reactionFields = getAllowedFields(commentReactions, FORBIDDEN_COLUMNS).join(", ");

export const listReactionsDocs = describeRoute({
  tags: ["Comment Interactions"],
  summary: "List Comment Reactions",
  description: `Paginated reactions on a comment. Filter: \`?reaction=like\`.\n\nIncludes: ${ALLOWED_INCLUDES.join(", ")}. Fields: ${reactionFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(ReactionRecordSchema)) } },
    },
    404: { description: "Comment not found" },
  },
});

export const createReactionDocs = describeRoute({
  tags: ["Comment Interactions"],
  summary: "React to Comment",
  security: [{ bearerAuth: [] }],
  description: "Like or dislike a comment. Upserts — calling again switches the reaction.",
  responses: {
    201: {
      description: "Created / Updated",
      content: { "application/json": { schema: resolver(MutationResponseSchema) } },
    },
    404: { description: "Comment not found" },
  },
});

export const deleteReactionDocs = describeRoute({
  tags: ["Comment Interactions"],
  summary: "Remove Comment Reaction",
  security: [{ bearerAuth: [] }],
  description: "Remove reaction. No ID needed — unique per user+comment.",
  responses: { 204: { description: "Removed" }, 404: { description: "Comment not found" } },
});
