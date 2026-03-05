import { Hono } from "hono";
import { validator } from "hono-openapi";
import { posts } from "$src/db/schema/posts";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith, generateSlug, sanitizeUpdates, getByIdOrSlug } from "$src/utils";
import { FORBIDDEN_COLUMNS, postListDocs, postDetailsDocs, deletePostDocs, PostIdentifierParamSchema, UPDATABLE_FIELDS, updatePostDocs, UpdatePostSchema, PostDetailsQuerySchema, PostListQuerySchema, createPostDocs, CreatePostSchema } from "./schema";
import { ACCESS } from "$src/db/schema";
import { guard, isOwnerOrRole } from "$src/middleware/auth";
import postComments from "./comments";

const app = new Hono<AppContext>();

export const POST_INCLUDES: Record<string, IncludeConfig<"posts">> = {
    authors: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
            author: {
                columns: { id: true, username: true }
            }
        }
    },
    categories: {
        requiredRole: ACCESS.Public,
        drizzleWith: {
            taxonomies: {
                columns: { id: true, name: true, type: true, slug: true, }
            }
        }
    },

} as const;

// GET /post
app.get("/", guard("optional"), postListDocs, validator("query", PostListQuerySchema), async (c) => {
    const db = c.get("db");
    const { fields, limit, page, include = [] } = c.req.valid("query");
    const userRole = c.get('role')

    const selection = buildFieldSelection(posts, fields, FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, POST_INCLUDES, userRole);

    const data = await db.query.posts.findMany({
        columns: selection,
        with: relationalWith,
        limit,
        offset: (page - 1) * limit,
    });

    return c.json({ data });
});

// GET /post/:identifier 
app.get("/:identifier", guard("optional"), postDetailsDocs, validator("param", PostIdentifierParamSchema), validator("query", PostDetailsQuerySchema), async (c) => {
    const db = c.get("db");
    const { identifier } = c.req.valid("param");
    const { fields, include = [] } = c.req.valid("query");
    const userRole = c.get("role");

    const selection = buildFieldSelection(posts, fields, FORBIDDEN_COLUMNS, { id: true });
    const relationalWith = buildRelationalWith(include, POST_INCLUDES, userRole);

    const data = await db.query.posts.findFirst({
        where: getByIdOrSlug(posts, identifier).query,
        columns: selection,
        with: relationalWith,
    });

    if (!data) return c.json({ error: "Post not found" }, 404);

    return c.json({ data });
});

// POST /post
app.post("/", guard('editor'), createPostDocs, validator("json", CreatePostSchema), async (c) => {
    const db = c.get("db");
    const userId = c.get("userId")!;
    const body = c.req.valid("json");

    const slug = body.slug ?? generateSlug(body.title);

    const existing = await db.query.posts.findFirst({
        where: { slug },
        columns: { id: true },
    });

    if (existing) return c.json({ error: "A post with this slug already exists" }, 409);

    const insertValues: typeof posts.$inferInsert = {
        authorId: userId,
        title: body.title,
        slug,
        content: body.content ?? "",
        excerpt: body.excerpt,
        featuredImageUrl: body.featuredImageUrl,
        status: body.status ?? "draft",
        type: body.type ?? "article",
        estimatedReadingMinutes: body.estimatedReadingMinutes,
    };

    if (body.status === "published") {
        insertValues.publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
    } else if (body.publishedAt) {
        insertValues.publishedAt = new Date(body.publishedAt);
    }

    const [created] = await db.insert(posts).values(insertValues).returning();

    return c.json({ data: created }, 201);
});


// PATCH /post/:identifier — Update post (auth + ownership)
app.patch("/:identifier", guard('editor'), updatePostDocs, validator("param", PostIdentifierParamSchema), validator("json", UpdatePostSchema), async (c) => {
    const db = c.get("db");
    const { identifier } = c.req.valid("param");
    const body = c.req.valid("json");

    const filter = getByIdOrSlug(posts, identifier).query
    const post = await db.query.posts.findFirst({
        where: filter,
        columns: { id: true, authorId: true, publishedAt: true },
    });

    if (!post) return c.json({ error: "Post not found" }, 404);
    if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: "Forbidden" }, 403);

    const sanitized = sanitizeUpdates(body, UPDATABLE_FIELDS);
    if (Object.keys(sanitized).length === 0) return c.json({ error: "No valid fields to update" }, 400);

    if ("publishedAt" in sanitized && sanitized.publishedAt != null) {
        (sanitized as any).publishedAt = new Date(sanitized.publishedAt as string);
    }

    if (sanitized.status === "published" && !sanitized.publishedAt && !post.publishedAt) {
        (sanitized as any).publishedAt = new Date();
    }

    const where = getByIdOrSlug(posts, identifier);

    const [updated] = await db.update(posts).set(sanitized).where(where.filter).returning();

    return c.json({ data: updated });
});

// DELETE /post/:identifier
app.delete("/:identifier", guard('admin'), deletePostDocs, validator("param", PostIdentifierParamSchema), async (c) => {
    const db = c.get("db");
    const { identifier } = c.req.valid("param");

    const post = await db.query.posts.findFirst({
        where: getByIdOrSlug(posts, identifier).query,
        columns: { id: true, authorId: true },
    });

    if (!post) return c.json({ error: "Post not found" }, 404);
    if (!isOwnerOrRole(c, post.authorId)) return c.json({ error: "Forbidden" }, 403);

    const where = getByIdOrSlug(posts, identifier);
    await db.update(posts).set({ status: "trashed" }).where(where.filter);

    return c.body(null, 204);
});

// /post/:identifier/comments
app.route("/:identifier/comments", postComments);

export default app;