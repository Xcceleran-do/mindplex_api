import { Hono } from "hono";
import { eq, and, count } from "drizzle-orm";
import { validator } from "hono-openapi";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { guard } from "$src/middleware/auth";
import { ACCESS } from "$src/db/schema/types";
import { commentReactions } from "$src/db/schema/socials";
import { CommentIdParamSchema } from "../schema";
import {
  FORBIDDEN_COLUMNS,
  ReactionListQuerySchema,
  CreateReactionSchema,
  listReactionsDocs,
  createReactionDocs,
  deleteReactionDocs,
} from "./schema";
import { DbClient } from "$src/db/client";

const app = new Hono<AppContext>();

const USER_DRIZZLE_WITH: IncludeConfig<"commentReactions">["drizzleWith"] = {
  user: {
    columns: { id: true, username: true },
    with: { profile: { columns: { avatarUrl: true } } },
  },
} as const;

const REACTION_INCLUDES: Record<string, IncludeConfig<"commentReactions">> = {
  user: { requiredRole: ACCESS.Public, drizzleWith: USER_DRIZZLE_WITH },
} as const;

// ─── Helpers ────────────────────────────────────────────────

async function findComment(db: DbClient, id: number) {
  return db.query.comments.findFirst({
    where: { id },
    columns: { id: true },
  });
}

// ═════════════════════════════════════════════════════════════
//  Comment Reactions  (like / dislike)
// ═════════════════════════════════════════════════════════════

// GET /:id/reactions
app.get(
  "/",
  guard("optional"),
  listReactionsDocs,
  validator("param", CommentIdParamSchema),
  validator("query", ReactionListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { limit, page, fields, include = [], reaction } = c.req.valid("query");
    const userRole = c.get("role");
    const { id } = c.req.valid("param");

    const comment = await findComment(db, id);
    if (!comment) return c.json({ error: "Comment not found" }, 404);

    const selection = buildFieldSelection(commentReactions, fields, FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, REACTION_INCLUDES, userRole);

    const where: Record<string, any> = { commentId: comment.id };
    if (reaction) where.reaction = reaction;

    const countConditions = reaction
      ? and(eq(commentReactions.commentId, comment.id), eq(commentReactions.reaction, reaction))
      : eq(commentReactions.commentId, comment.id);

    const [data, [{ total }]] = await Promise.all([
      db.query.commentReactions.findMany({
        where,
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ total: count() }).from(commentReactions).where(countConditions),
    ]);

    return c.json({ data, total });
  },
);

// POST /:id/reactions
app.post(
  "/",
  guard("user"),
  createReactionDocs,
  validator("param", CommentIdParamSchema),
  validator("json", CreateReactionSchema),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const { reaction } = c.req.valid("json");
    const { id } = c.req.valid("param");

    const comment = await findComment(db, id);
    if (!comment) return c.json({ error: "Comment not found" }, 404);

    const [record] = await db
      .insert(commentReactions)
      .values({ commentId: comment.id, userId, reaction })
      .onConflictDoUpdate({
        target: [commentReactions.commentId, commentReactions.userId],
        set: { reaction },
      })
      .returning();

    return c.json({ data: record }, 201);
  },
);

// DELETE /:id/reactions
app.delete("/", guard("user"), deleteReactionDocs, validator("param", CommentIdParamSchema), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId")!;
  const { id } = c.req.valid("param");

  const comment = await findComment(db, id);
  if (!comment) return c.json({ error: "Comment not found" }, 404);

  await db
    .delete(commentReactions)
    .where(and(eq(commentReactions.commentId, comment.id), eq(commentReactions.userId, userId)));

  return c.body(null, 204);
});

export default app;
