import * as v from "valibot";
import { PaginationLimitSchema, PaginationPageSchema } from "$src/lib/validators";
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from "$src/utils";
import { postReactions, postEmojis, bookmarks, shares, peoplesChoiceVotes } from "$src/db/schema/socials";
import { describeRoute, resolver } from "hono-openapi";

// ─── Shared Constants ───────────────────────────────────────

export const INTERACTION_ALLOWED_INCLUDES = ["user"];

// ─── Per-Table Forbidden Columns ────────────────────────────
// postId and userId are implicit from URL context and ?include=user.

export const REACTION_FORBIDDEN = new Set<string>(["postId", "userId"]);
export const EMOJI_FORBIDDEN = new Set<string>(["postId", "userId"]);
export const BOOKMARK_FORBIDDEN = new Set<string>(["postId", "userId"]);
export const SHARE_FORBIDDEN = new Set<string>(["postId", "userId"]);
export const VOTE_FORBIDDEN = new Set<string>(["postId", "userId"]);

// ─── Param Schemas ──────────────────────────────────────────

export const IdentifierWithEmojiParamSchema = v.object({
  identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  emojiValue: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
});

// ─── Query Schemas ──────────────────────────────────────────

export const ReactionListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(postReactions, REACTION_FORBIDDEN),
  include: createIncludesSchema(INTERACTION_ALLOWED_INCLUDES),
  reaction: v.optional(v.picklist(["like", "dislike"])),
});

export const EmojiListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(postEmojis, EMOJI_FORBIDDEN),
  include: createIncludesSchema(INTERACTION_ALLOWED_INCLUDES),
  sentiment: v.optional(v.picklist(["positive", "negative"])),
});

export const BookmarkListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(bookmarks, BOOKMARK_FORBIDDEN),
  include: createIncludesSchema(INTERACTION_ALLOWED_INCLUDES),
});

export const ShareListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(shares, SHARE_FORBIDDEN),
  include: createIncludesSchema(INTERACTION_ALLOWED_INCLUDES),
});

export const VoteListQuerySchema = v.object({
  limit: PaginationLimitSchema,
  page: PaginationPageSchema,
  fields: createFieldsSchema(peoplesChoiceVotes, VOTE_FORBIDDEN),
  include: createIncludesSchema(INTERACTION_ALLOWED_INCLUDES),
});

// ─── Body Schemas ───────────────────────────────────────────

export const CreateReactionSchema = v.object({
  reaction: v.picklist(["like", "dislike"]),
});

export const CreateEmojiSchema = v.object({
  emojiValue: v.pipe(v.string(), v.minLength(1), v.maxLength(20)),
  sentiment: v.picklist(["positive", "negative"]),
});

export const CreateShareSchema = v.object({
  platform: v.pipe(v.string(), v.minLength(1), v.maxLength(50)),
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

const EmojiRecordSchema = v.object({
  id: v.number(),
  emojiValue: v.optional(v.string()),
  sentiment: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  user: v.optional(InteractionUserSchema),
});

const BookmarkRecordSchema = v.object({
  id: v.number(),
  createdAt: v.optional(v.string()),
  user: v.optional(InteractionUserSchema),
});

const ShareRecordSchema = v.object({
  id: v.number(),
  platform: v.optional(v.nullable(v.string())),
  externalShareId: v.optional(v.nullable(v.string())),
  createdAt: v.optional(v.string()),
  user: v.optional(InteractionUserSchema),
});

const VoteRecordSchema = v.object({
  id: v.number(),
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

// — Reactions —

const reactionFields = getAllowedFields(postReactions, REACTION_FORBIDDEN).join(", ");

export const listReactionsDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "List Reactions",
  description: `Paginated reactions. Filter: \`?reaction=like\`.\n\nIncludes: ${INTERACTION_ALLOWED_INCLUDES.join(", ")}. Fields: ${reactionFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(ReactionRecordSchema)) } },
    },
    404: { description: "Post not found" },
  },
});

export const createReactionDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "React to Post",
  security: [{ bearerAuth: [] }],
  description: "Like or dislike. Upserts — calling again switches the reaction.",
  responses: {
    201: {
      description: "Created / Updated",
      content: { "application/json": { schema: resolver(MutationResponseSchema) } },
    },
    404: { description: "Post not found" },
  },
});

export const deleteReactionDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Remove Reaction",
  security: [{ bearerAuth: [] }],
  description: "Remove reaction. No ID needed — unique per user+post.",
  responses: { 204: { description: "Removed" }, 404: { description: "Post not found" } },
});

// — Emojis —

const emojiFields = getAllowedFields(postEmojis, EMOJI_FORBIDDEN).join(", ");

export const listEmojisDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "List Emojis",
  description: `Paginated emoji reactions. Filter: \`?sentiment=positive\`.\n\nIncludes: ${INTERACTION_ALLOWED_INCLUDES.join(", ")}. Fields: ${emojiFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(EmojiRecordSchema)) } },
    },
    404: { description: "Post not found" },
  },
});

export const createEmojiDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Add Emoji Reaction",
  security: [{ bearerAuth: [] }],
  description: "Add an emoji reaction. Multiple different emojis per user allowed.",
  responses: {
    201: { description: "Created", content: { "application/json": { schema: resolver(MutationResponseSchema) } } },
    404: { description: "Post not found" },
  },
});

export const deleteEmojiDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Remove Emoji Reaction",
  security: [{ bearerAuth: [] }],
  description: "Remove a specific emoji reaction by its value.",
  responses: { 204: { description: "Removed" }, 404: { description: "Post or emoji not found" } },
});

// — Bookmarks —

const bookmarkFields = getAllowedFields(bookmarks, BOOKMARK_FORBIDDEN).join(", ");

export const listBookmarksDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "List Bookmarks",
  description: `Paginated bookmarks.\n\nIncludes: ${INTERACTION_ALLOWED_INCLUDES.join(", ")}. Fields: ${bookmarkFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(BookmarkRecordSchema)) } },
    },
    404: { description: "Post not found" },
  },
});

export const createBookmarkDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Bookmark Post",
  security: [{ bearerAuth: [] }],
  description: "Bookmark a post. Idempotent.",
  responses: {
    201: { description: "Bookmarked", content: { "application/json": { schema: resolver(MutationResponseSchema) } } },
    404: { description: "Post not found" },
  },
});

export const deleteBookmarkDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Remove Bookmark",
  security: [{ bearerAuth: [] }],
  responses: { 204: { description: "Removed" }, 404: { description: "Post not found" } },
});

// — Shares —

const shareFields = getAllowedFields(shares, SHARE_FORBIDDEN).join(", ");

export const listSharesDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "List Shares",
  description: `Paginated shares.\n\nIncludes: ${INTERACTION_ALLOWED_INCLUDES.join(", ")}. Fields: ${shareFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(ShareRecordSchema)) } },
    },
    404: { description: "Post not found" },
  },
});

export const createShareDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Record Share",
  security: [{ bearerAuth: [] }],
  description: "Log a share on an external platform. Multiple shares allowed.",
  responses: {
    201: { description: "Recorded", content: { "application/json": { schema: resolver(MutationResponseSchema) } } },
    404: { description: "Post not found" },
  },
});

// — People's Choice —

const voteFields = getAllowedFields(peoplesChoiceVotes, VOTE_FORBIDDEN).join(", ");

export const listPeoplesChoiceDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "List People's Choice Votes",
  description: `Paginated voters.\n\nIncludes: ${INTERACTION_ALLOWED_INCLUDES.join(", ")}. Fields: ${voteFields}`,
  responses: {
    200: {
      description: "OK",
      content: { "application/json": { schema: resolver(paginatedResponse(VoteRecordSchema)) } },
    },
    404: { description: "Post not found" },
  },
});

export const createPeoplesChoiceDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Vote for Post",
  security: [{ bearerAuth: [] }],
  description: "Cast a People's Choice vote. Idempotent.",
  responses: {
    201: { description: "Voted", content: { "application/json": { schema: resolver(MutationResponseSchema) } } },
    404: { description: "Post not found" },
  },
});

export const deletePeoplesChoiceDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Remove Vote",
  security: [{ bearerAuth: [] }],
  responses: { 204: { description: "Removed" }, 404: { description: "Post not found" } },
});

// — Views —

export const recordViewDocs = describeRoute({
  tags: ["Post Interactions"],
  summary: "Track View",
  description: "Fire-and-forget view tracking. Increments the view counter. Returns `202 Accepted`.",
  responses: { 202: { description: "Accepted" }, 404: { description: "Post not found" } },
});
