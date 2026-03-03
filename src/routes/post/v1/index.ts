import { Hono } from "hono";
import { validator } from "hono-openapi";
import { posts } from "$src/db/schema/posts";
import type { AppContext, IncludeConfig } from "$src/types";
import { buildFieldSelection, buildRelationalWith } from "$src/utils";
import { PostSchema, FORBIDDEN_COLUMNS, postListDocs, postDetailsDocs, PostDetailsSchema, PostIdParamSchema } from "./schema";
import { ACCESS } from "$src/db/schema";

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


app.get('/', postListDocs, validator('query', PostSchema), async (c) => {
    const db = c.get("db")
    const { fields, limit, page, include = [] } = c.req.valid("query")
    const userRole = ACCESS.Public

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

app.get('/:id', postDetailsDocs, validator('param', PostIdParamSchema), validator('query', PostDetailsSchema), async (c) => {
    const db = c.get("db")
    const { fields, include = [] } = c.req.valid("query")
    const { id } = c.req.valid("param")

    const userRole = ACCESS.Public

    let baseSelection: Record<string, any> = { id: true };
    const selection = buildFieldSelection(posts, fields, FORBIDDEN_COLUMNS, baseSelection);
    const relationalWith = buildRelationalWith(include, POST_INCLUDES, userRole)


    const data = await db.query.posts.findFirst({
        where: { id },
        columns: selection,
        with: relationalWith,
    });

    return c.json({ data })

})



    return c.json({ data })

})

export default app;