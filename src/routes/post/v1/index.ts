import { Hono } from "hono";
import { posts } from "$src/db/schema/posts";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { validator } from "hono-openapi";
import { PostSchema, FORBIDDEN_COLUMNS } from "./schema";
import { ACCESS } from "$src/db/schema";

const app = new Hono<AppContext>();

export const POST_INCLUDES: Record<string, IncludeConfig<"posts">> = {
    authors: {
        requiredRole: ACCESS.Admin,
        drizzleWith: {
            author: {
                columns: { id: true, username: true, passwordHash: true }
            }
        }
    },

    categories: {
        requiredRole: ACCESS.User,
        drizzleWith: {
            taxonomies: {
                columns: { id: true, name: true, type: true, slug: true, }
            }
        }
    },

} as const;


app.get('/', validator('query', PostSchema), async (c) => {
    const db = c.get("db")
    const { fields, limit, page, include = [] } = c.req.valid("query")
    const userRole = ACCESS.User

    let baseSelection: Record<string, any> = { id: true };
    const selection = buildFieldSelection(posts, fields, FORBIDDEN_COLUMNS, baseSelection);
    const relationalWith = buildRelationalWith(include, POST_INCLUDES, userRole)


    const data = await db.query.posts.findMany({
        columns: selection,
        with: relationalWith,
        limit: limit,
        offset: (page - 1) * limit
    });

    return c.json({ data })

})

export default app;