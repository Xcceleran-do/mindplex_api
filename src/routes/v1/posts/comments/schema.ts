import * as v from "valibot";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { PaginationLimitSchema, PaginationPageSchema } from "$src/lib/validators";
import { comments } from "$src/db/schema";
import { getColumns } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";

const commentsCols = getColumns(comments);
type CommentColumn = keyof typeof commentsCols;

export const FORBIDDEN_COLUMNS = new Set<CommentColumn>(["guestAuthorName", "guestAuthorEmail"]);
export const ALLOWED_INCLUDES = ["author", "replies"];

// ─── Query Schemas ──────────────────────────────────────────

export const CommentListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(comments, FORBIDDEN_COLUMNS),
  include: createIncludesSchema(ALLOWED_INCLUDES),
  status: v.optional(v.picklist(["approved", "pending", "spam", "trashed"]), "approved"),
});

// ─── Body Schemas ───────────────────────────────────────────

export const CreateCommentSchema = v.object({
  content: v.pipe(v.string(), v.minLength(1, "Content is required"), v.maxLength(10000)),
  parentId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
});

// ─── Response Schemas ───────────────────────────────────────

const CommentAuthorSchema = v.object({ id: v.number(), username: v.string() });

export const CommentRecordSchema = v.object({
  id: v.number(),
  postId: v.number(),
  content: v.string(),
  status: v.string(),
  parentId: v.optional(v.nullable(v.number())),
  author: v.optional(v.nullable(CommentAuthorSchema)),
  createdAt: v.string(),
});

export const CommentListResponseSchema = v.object({
  data: v.array(CommentRecordSchema),
});

// ─── OpenAPI Docs ───────────────────────────────────────────

const fieldsList = getAllowedFields(comments, FORBIDDEN_COLUMNS).join(", ");

export const listCommentsDocs = describeRoute({
  tags: ["Comments"],
  summary: "List Comments for Post",
  description: `Paginated comments for a post. Defaults to ?status=approved.\n\nIncludes: ${ALLOWED_INCLUDES.join(", ")}. Fields: ${fieldsList}`,
  responses: {
    200: {
      description: "OK",
      content: {
        "application/json": { schema: resolver(CommentListResponseSchema) },
      },
    },
    404: { description: "Post not found" },
  },
});

export const createCommentDocs = describeRoute({
  tags: ["Comments"],
  summary: "Create Comment",
  security: [{ bearerAuth: [] }],
  description:
    "Creates a comment on a post. Requires authentication. All comments start as pending until approved by moderation.",
  responses: {
    201: {
      description: "Created",
      content: {
        "application/json": { schema: resolver(CommentRecordSchema) },
      },
    },
    401: { description: "Unauthorized" },
    403: { description: "Comments disabled for this post" },
    404: { description: "Post not found" },
  },
});
