import { Hono } from "hono";
import { validator } from "hono-openapi";
import { comments } from "$src/db/schema/comments";
import { posts } from "$src/db/schema/posts";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith, getByIdOrSlug } from "$src/utils";
import { guard } from "$src/middleware/auth";
import { ACCESS } from "$src/db/schema";
import {
    FORBIDDEN_COLUMNS,
    CommentListQuerySchema,
    CreateCommentSchema,
    listCommentsDocs,
    createCommentDocs,
} from "./schema";
import { PostIdentifierParamSchema } from '../schema';

const app = new Hono<AppContext>();

const COMMENT_INCLUDES: Record<string, IncludeConfig<"comments">> = {
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


// GET /posts/:identifier/comments
app.get("/", guard("optional"), listCommentsDocs, validator("param", PostIdentifierParamSchema), validator("query", CommentListQuerySchema), async (c) => {
    const db = c.get("db");
    const { identifier } = c.req.valid("param");
    const { limit, page, status, fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const filter = getByIdOrSlug(posts, identifier).query;
    const post = await db.query.posts.findFirst({
        where: filter,
        columns: { id: true },
    });

    if (!post) return c.json({ error: "Post not found" }, 404);

    const selection = buildFieldSelection(comments, fields, FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, COMMENT_INCLUDES, userRole);
    const data = await db.query.comments.findMany({
        where: { postId: post.id, status, parentId: { isNull: true } },
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
    });

    return c.json({ data });
});


// POST /posts/:identifier/comments
app.post("/", guard("user"), createCommentDocs, validator("param", PostIdentifierParamSchema), validator("json", CreateCommentSchema), async (c) => {
    const db = c.get("db");
    const { identifier } = c.req.valid("param");
    const body = c.req.valid("json");
    const userId = c.get("userId")!;

    const filter = getByIdOrSlug(posts, identifier).query;
    const post = await db.query.posts.findFirst({
        where: filter,
        columns: { id: true, commentEnabled: true },
    });

    if (!post) return c.json({ error: "Post not found" }, 404);

    if (!post.commentEnabled) {
        return c.json({ error: "Comments are disabled for this post" }, 403);
    }

    // Verify parent belongs to same post
    if (body.parentId) {
        const parent = await db.query.comments.findFirst({
            where: { id: body.parentId, postId: post.id },
            columns: { id: true },
        });

        if (!parent) return c.json({ error: "Parent comment not found on this post" }, 404);
    }

    const [created] = await db.insert(comments).values({
        postId: post.id,
        authorId: userId,
        content: body.content,
        parentId: body.parentId,
        status: "pending",
    }).returning();

    return c.json({ data: created }, 201);
});


export default app;