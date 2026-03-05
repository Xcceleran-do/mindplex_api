import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { validator } from "hono-openapi";
import { comments } from "$src/db/schema/comments";
import type { AppContext, IncludeConfig } from "$src/types";
import { guard, isOwnerOrRole } from "$src/middleware/auth";
import { ACCESS, ROLE } from "$src/db/schema/types";
import {
  CommentIdParamSchema,
  UpdateCommentSchema,
  updateCommentDocs,
  deleteCommentDocs,
  listRepliesDocs,
  ReplyListQuerySchema,
} from "./schema";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { FORBIDDEN_COLUMNS } from "$src/routes/v1/posts/comments/schema";
import commentInteractionRoutes from "./interactions";

const app = new Hono<AppContext>();

export const COMMENT_INCLUDES: Record<string, IncludeConfig<"comments">> = {
  author: {
    requiredRole: ACCESS.Public,
    drizzleWith: {
      author: { columns: { id: true, username: true } },
    },
  },
  replies: {
    requiredRole: ACCESS.Public,
    drizzleWith: {
      replies: {
        columns: { id: true, content: true, parentId: true, createdAt: true },
        with: {
          author: { columns: { id: true, username: true } },
        },
      },
    },
  },
} as const;

// GET /comments/:id/replies
app.get(
  "/:id/replies",
  guard("optional"),
  listRepliesDocs,
  validator("param", CommentIdParamSchema),
  validator("query", ReplyListQuerySchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const { limit, page, status, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const parent = await db.query.comments.findFirst({
      where: { id },
      columns: { id: true },
    });

    if (!parent) return c.json({ error: "Comment not found" }, 404);

    const selection = buildFieldSelection(comments, fields, FORBIDDEN_COLUMNS, {
      id: true,
    });
    const relationalWith = buildRelationalWith(include, COMMENT_INCLUDES, userRole);

    const data = await db.query.comments.findMany({
      where: { parentId: id, status },
      columns: selection,
      with: relationalWith,
      limit,
      offset: (page - 1) * limit,
    });

    return c.json({ data });
  },
);

// PATCH /comments/:id
app.patch(
  "/:id",
  guard("user"),
  updateCommentDocs,
  validator("param", CommentIdParamSchema),
  validator("json", UpdateCommentSchema),
  async (c) => {
    const db = c.get("db");
    const { id } = c.req.valid("param");
    const { content } = c.req.valid("json");

    const comment = await db.query.comments.findFirst({
      where: { id },
      columns: { id: true, authorId: true },
    });

    if (!comment) return c.json({ error: "Comment not found" }, 404);
    if (!isOwnerOrRole(c, comment.authorId!, ROLE.Moderator)) return c.json({ error: "Forbidden" }, 403);

    const [updated] = await db.update(comments).set({ content }).where(eq(comments.id, id)).returning();

    return c.json({ data: updated });
  },
);

// DELETE /comments/:id
app.delete("/:id", guard("user"), deleteCommentDocs, validator("param", CommentIdParamSchema), async (c) => {
  const db = c.get("db");
  const { id } = c.req.valid("param");

  const comment = await db.query.comments.findFirst({
    where: { id },
    columns: { id: true, authorId: true },
  });

  if (!comment) return c.json({ error: "Comment not found" }, 404);
  if (!isOwnerOrRole(c, comment.authorId!, ROLE.Moderator)) return c.json({ error: "Forbidden" }, 403);

  await db.delete(comments).where(eq(comments.id, id));

  return c.body(null, 204);
});

app.route("/:id/interactions", commentInteractionRoutes);

export default app;
