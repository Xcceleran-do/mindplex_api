import { Hono } from "hono";
import auth from "./auth";
import post from "./posts";

const v1 = new Hono();

v1.route('/auth', auth);
v1.route('/posts', post);

export default v1;