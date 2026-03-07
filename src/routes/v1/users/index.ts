import { Hono } from "hono";
import type { AppContext } from "$src/types";
import me from "./me";

const app = new Hono<AppContext>();


app.route("/me", me);

// app.route("/:username", usernameRouter);

export default app;