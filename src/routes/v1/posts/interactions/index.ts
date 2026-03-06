import { Hono } from "hono";
import { eq, and, count, sql } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext, IncludeConfig } from "$src/types";
import { getByIdOrSlug, buildFieldSelection, buildRelationalWith } from "$src/utils";
import { guard } from "$src/middleware/auth";
import { ACCESS } from "$src/db/schema/types";
import { posts } from "$src/db/schema/posts";

import { postReactions, postEmojis, bookmarks, shares, peoplesChoiceVotes } from "$src/db/schema/socials";
import { PostIdentifierParamSchema } from "../schema";
import {
  REACTION_FORBIDDEN,
  EMOJI_FORBIDDEN,
  BOOKMARK_FORBIDDEN,
  SHARE_FORBIDDEN,
  VOTE_FORBIDDEN,
  ReactionListQuerySchema,
  EmojiListQuerySchema,
  BookmarkListQuerySchema,
  ShareListQuerySchema,
  VoteListQuerySchema,
  CreateReactionSchema,
  CreateEmojiSchema,
  CreateShareSchema,
  IdentifierWithEmojiParamSchema,
  listReactionsDocs,
  createReactionDocs,
  deleteReactionDocs,
  listEmojisDocs,
  createEmojiDocs,
  deleteEmojiDocs,
  listBookmarksDocs,
  createBookmarkDocs,
  deleteBookmarkDocs,
  listSharesDocs,
  createShareDocs,
  listPeoplesChoiceDocs,
  createPeoplesChoiceDocs,
  deletePeoplesChoiceDocs,
  recordViewDocs,
} from "./schema";
import { DbClient } from "$src/db/client";

const app = new Hono<AppContext>();

const USER_DRIZZLE_WITH: IncludeConfig<"postReactions">["drizzleWith"] = {
  user: {
    columns: { id: true, username: true },
    with: { profile: { columns: { avatarUrl: true } } },
  },
} as const;

const REACTION_INCLUDES: Record<string, IncludeConfig<"postReactions">> = {
  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;


const EMOJI_INCLUDES: Record<string, IncludeConfig<"postEmojis">> = {
  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;

const BOOKMARK_INCLUDES: Record<string, IncludeConfig<"bookmarks">> = {
  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;

const SHARE_INCLUDES: Record<string, IncludeConfig<"shares">> = {

  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;

const VOTE_INCLUDES: Record<string, IncludeConfig<"peoplesChoiceVotes">> = {
  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;

/**
 * Resolve a post from the :identifier param (slug or numeric id).
 * Returns `{ id }` or `null`.
 */
async function findPost(db: DbClient, identifier: string) {
  return db.query.posts.findFirst({
    where: getByIdOrSlug(posts, identifier).query,
    columns: { id: true },
  });
}

// ═════════════════════════════════════════════════════════════
//  Reactions  (like / dislike)
// ═════════════════════════════════════════════════════════════

// GET /reactions
app.get(
  "/reactions",
  guard("optional"),
  listReactionsDocs,
  validator("param", PostIdentifierParamSchema),
  validator("query", ReactionListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [], reaction } = c.req.valid("query");
    const userRole = c.get("role");
    const { identifier } = c.req.valid("param");

    const post = await findPost(db, identifier);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(postReactions, fields, REACTION_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, REACTION_INCLUDES, userRole);

    const where: Record<string, any> = { postId: post.id };
    if (reaction) where.reaction = reaction;

    const countConditions = reaction
      ? and(eq(postReactions.postId, post.id), eq(postReactions.reaction, reaction))
      : eq(postReactions.postId, post.id);

    const [data, [{ total }]] = await Promise.all([
      db.query.postReactions.findMany({
        where,
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(postReactions).where(countConditions),
    ]);

    return c.json({ data, total });
  },
);

// POST /reactions
app.post(
  "/reactions",
  guard("user"),
  createReactionDocs,
  validator("param", PostIdentifierParamSchema),
  validator("json", CreateReactionSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { reaction } = c.req.valid("json");
    const { identifier } = c.req.valid("param");

    const post = await findPost(db, identifier);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const [record] = await db
      .insert(postReactions)
      .values({ postId: post.id, userId, reaction })
      .onConflictDoUpdate({
        target: [postReactions.postId, postReactions.userId],
        set: { reaction },
      })
      .returning();

    return c.json({ data: record }, 201);
  },
);

// DELETE /reactions
app.delete(
  "/reactions",
  guard("user"),
  deleteReactionDocs,
  validator("param", PostIdentifierParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { identifier } = c.req.valid("param");

    const post = await findPost(db, identifier);
    if (!post) return c.json({ error: "Post not found" }, 404);

    await db.delete(postReactions).where(and(eq(postReactions.postId, post.id), eq(postReactions.userId, userId)));

    return c.body(null, 204);
  },
);

// ═════════════════════════════════════════════════════════════
//  Emojis
// ═════════════════════════════════════════════════════════════

// GET /emojis
app.get(
  "/emojis",
  guard("optional"),
  listEmojisDocs,
  validator("param", PostIdentifierParamSchema),
  validator("query", EmojiListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [], sentiment } = c.req.valid("query");
    const userRole = c.get("role");
    const { identifier } = c.req.valid("param");

    const post = await findPost(db, identifier);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(postEmojis, fields, EMOJI_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, EMOJI_INCLUDES, userRole);

    const where: Record<string, any> = { postId: post.id };
    if (sentiment) where.sentiment = sentiment;

    const countConditions = sentiment
      ? and(eq(postEmojis.postId, post.id), eq(postEmojis.sentiment, sentiment))
      : eq(postEmojis.postId, post.id);

    const [data, [{ total }]] = await Promise.all([
      db.query.postEmojis.findMany({
        where,
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(postEmojis).where(countConditions),
    ]);

    return c.json({ data, total });
  },
);

// POST /emojis
app.post(
  "/emojis",
  guard("user"),
  createEmojiDocs,
  validator("param", PostIdentifierParamSchema),
  validator("json", CreateEmojiSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { emojiValue, sentiment } = c.req.valid("json");
    const { identifier } = c.req.valid("param");

    const post = await findPost(db, identifier);
    if (!post) return c.json({ error: "Post not found" }, 404);

    const [record] = await db
      .insert(postEmojis)
      .values({ postId: post.id, userId, emojiValue, sentiment })
      .onConflictDoUpdate({
        target: [postEmojis.postId, postEmojis.userId, postEmojis.emojiValue],
        set: { sentiment },
      })
      .returning();

    return c.json({ data: record }, 201);
  },
);

// DELETE /emojis/:emojiValue
app.delete(
  "/emojis/:emojiValue",
  guard("user"),
  deleteEmojiDocs,
  validator("param", IdentifierWithEmojiParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { identifier, emojiValue } = c.req.valid("param");

    const post = await db.query.posts.findFirst({
      where: getByIdOrSlug(posts, identifier).query,
      columns: { id: true },
    });
    if (!post) return c.json({ error: "Post not found" }, 404);

    await db
      .delete(postEmojis)
      .where(
        and(
          eq(postEmojis.postId, post.id),
          eq(postEmojis.userId, userId),
          eq(postEmojis.emojiValue, decodeURIComponent(emojiValue)),
        ),
      );

    return c.body(null, 204);
  },
);

// ═════════════════════════════════════════════════════════════
//  Bookmarks
// ═════════════════════════════════════════════════════════════

// GET /bookmarks
app.get(
  "/bookmarks",
  guard("optional"),
  listBookmarksDocs,
  validator("param", PostIdentifierParamSchema),
  validator("query", BookmarkListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(bookmarks, fields, BOOKMARK_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, BOOKMARK_INCLUDES, userRole);

    const [data, [{ total }]] = await Promise.all([
      db.query.bookmarks.findMany({
        where: { postId: post.id },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(bookmarks).where(eq(bookmarks.postId, post.id)),
    ]);

    return c.json({ data, total });
  },
);

// POST /bookmarks
app.post("/bookmarks", guard("user"), createBookmarkDocs, validator("param", PostIdentifierParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { identifier } = c.req.valid("param");
  const post = await findPost(db, identifier);

  if (!post) return c.json({ error: "Post not found" }, 404);

  const [record] = await db
    .insert(bookmarks)
    .values({ postId: post.id, userId })
    .onConflictDoUpdate({
      target: [bookmarks.userId, bookmarks.postId],
      set: { userId },
    })
    .returning();

  return c.json({ data: record }, 201);
});

// DELETE /bookmarks
app.delete(
  "/bookmarks",
  guard("user"),
  deleteBookmarkDocs,
  validator("param", PostIdentifierParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    await db.delete(bookmarks).where(and(eq(bookmarks.postId, post.id), eq(bookmarks.userId, userId)));

    return c.body(null, 204);
  },
);

// ═════════════════════════════════════════════════════════════
//  Shares
// ═════════════════════════════════════════════════════════════

// GET /shares
app.get(
  "/shares",
  guard("optional"),
  listSharesDocs,
  validator("param", PostIdentifierParamSchema),
  validator("query", ShareListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(shares, fields, SHARE_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, SHARE_INCLUDES, userRole);

    const [data, [{ total }]] = await Promise.all([
      db.query.shares.findMany({
        where: { postId: post.id },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(shares).where(eq(shares.postId, post.id)),
    ]);

    return c.json({ data, total });
  },
);

// POST /shares
app.post(
  "/shares",
  guard("user"),
  createShareDocs,
  validator("param", PostIdentifierParamSchema),
  validator("json", CreateShareSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { platform } = c.req.valid("json");
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    const [record] = await db.insert(shares).values({ postId: post.id, userId, platform }).returning();

    return c.json({ data: record }, 201);
  },
);

// ═════════════════════════════════════════════════════════════
//  People's Choice
// ═════════════════════════════════════════════════════════════

// GET /peoples-choice
app.get(
  "/peoples-choice",
  guard("optional"),
  listPeoplesChoiceDocs,
  validator("param", PostIdentifierParamSchema),
  validator("query", VoteListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(peoplesChoiceVotes, fields, VOTE_FORBIDDEN, { id: true });
    const relationalWith = buildRelationalWith(include, VOTE_INCLUDES, userRole);

    const [data, [{ total }]] = await Promise.all([
      db.query.peoplesChoiceVotes.findMany({
        where: { postId: post.id },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(peoplesChoiceVotes).where(eq(peoplesChoiceVotes.postId, post.id)),
    ]);

    return c.json({ data, total });
  },
);

// POST /peoples-choice
app.post(
  "/peoples-choice",
  guard("user"),
  createPeoplesChoiceDocs,
  validator("param", PostIdentifierParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    const [record] = await db
      .insert(peoplesChoiceVotes)
      .values({ postId: post.id, userId })
      .onConflictDoUpdate({
        target: [peoplesChoiceVotes.userId, peoplesChoiceVotes.postId],
        set: { userId },
      })
      .returning();

    return c.json({ data: record }, 201);
  },
);

// DELETE /peoples-choice
app.delete(
  "/peoples-choice",
  guard("user"),
  deletePeoplesChoiceDocs,
  validator("param", PostIdentifierParamSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { identifier } = c.req.valid("param");
    const post = await findPost(db, identifier);

    if (!post) return c.json({ error: "Post not found" }, 404);

    await db
      .delete(peoplesChoiceVotes)
      .where(and(eq(peoplesChoiceVotes.postId, post.id), eq(peoplesChoiceVotes.userId, userId)));

    return c.body(null, 204);
  },
);

// POST /views
app.post("/views", guard("optional"), recordViewDocs, validator("param", PostIdentifierParamSchema), async (c) => {
  const db = c.get("db");
  const { identifier } = c.req.valid("param") as { identifier: string };

  const filter = getByIdOrSlug(posts, identifier);
  const post = await db.query.posts.findFirst({
    where: filter.query,
    columns: { id: true },
  });
  if (!post) return c.json({ error: "Post not found" }, 404);

  await db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(filter.filter);

  return c.body(null, 202);
});

export default app;
