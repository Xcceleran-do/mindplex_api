import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from '$src/db/schema'
import { registerDocs } from "$src/lib/openapi";
import { AppContext } from "$src/types";
import auth from "$src/routes/auth";
import { env } from '$env'
import { debugMode } from "$src/middleware/debug";
import { wordpressProxy } from '$src/middleware/wordpressProxy';

const app = new Hono<AppContext>();

const ssl = env.DB_USE_SSL === 'true' ? {
  rejectUnauthorized: false,
} : false


const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: ssl
});

const db = drizzle({ schema, client: pool });

const dbMiddleware = createMiddleware(async (c, next) => {
  c.set("db", db);
  c.set("schema", schema);
  await next();
});

app.use(dbMiddleware);
app.use('*', debugMode);

registerDocs(app);

app.route('/auth', auth);
app.get("/", (c) => {
  return c.json({
    message:
      "This service is not meant to be accessed directly. Use the API endpoints instead.",
  });
});

app.get("/health", async (c) => {
  try {
    const db = c.get("db");
    const result = await db.execute("select 1");

    if (result && result.rows[0]["?column?"] === 1) {
      return c.json({ status: "ok" });
    } else {
      c.status(500);
      return c.json({ status: "error" });
    }
  } catch (error) {
    console.error(error);
    const msg = JSON.stringify(error);
    return c.json({ error: "Failed to check database health " + msg }, 500);
  }
});


app.use('/wp/*', wordpressProxy);
export default app;
