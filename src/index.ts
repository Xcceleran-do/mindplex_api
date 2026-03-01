import { Hono } from "hono";
import { registerDocs } from "$src/lib/openapi";
import { AppContext } from "$src/types";

import auth from "$src/routes/auth";
import { debugMode } from "$src/middleware/debug";
import { wordpressProxy } from '$src/middleware/wordpressProxy';
import post from "$src/routes/post/v1";
import { dbMiddleware } from "$src/middleware/db";

const app = new Hono<AppContext>();

app.use(dbMiddleware);
app.use('*', debugMode);

registerDocs(app);

app.route('/auth', auth);
app.route('/', post);


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
