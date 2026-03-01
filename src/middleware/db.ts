import { createMiddleware } from "hono/factory";
import { db } from "$src/db/client";
import * as schema from "$src/db/schema";

export const dbMiddleware = createMiddleware(async (c, next) => {
    c.set('db', db);
    c.set('schema', schema)
    await next();
});