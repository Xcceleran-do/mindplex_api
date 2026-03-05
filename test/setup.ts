/**
 * Test setup and helpers.
 */

import { generateAccessToken } from "$src/lib/jwt";
import { db } from "$src/db/client";
import * as schema from "$src/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import type { Role } from "$src/db/schema/types";
import app from "$src/index";

const BASE = "http://localhost:3000";

const TEST_PREFIX = "test-";

type TestUser = {
  id: number;
  token: string;
  email: string;
  username: string;
  role: Role;
};

type TestComment = {
  id: number;
  postId: number;
  authorId: number;
  parentId?: number;
};

const tokenCache = new Map<string, TestUser>();

export async function asRole(role: Role): Promise<TestUser> {
  if (tokenCache.has(role)) return tokenCache.get(role)!;

  const username = `${TEST_PREFIX}${role}`;
  const email = `${username}@test.local`;
  const password = "testpass";

  let [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1);

  if (!user) {
    const hash = await Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: 4096,
      timeCost: 1,
    });
    [user] = await db
      .insert(schema.users)
      .values({
        username,
        email,
        passwordHash: hash,
        role,
        isActivated: true,
      })
      .returning({ id: schema.users.id });
  }

  const token = await generateAccessToken({
    sub: String(user.id),
    email,
    role,
    sessionId: `test-${role}`,
  });

  const testUser: TestUser = { id: user.id, token, email, username, role };
  tokenCache.set(role, testUser);
  return testUser;
}

export type SeededData = {
  users: {
    admin: TestUser;
    editor: TestUser;
    moderator: TestUser;
    user: TestUser;
  };
  posts: { id: number; slug: string; authorId: number }[];
  comments: {
    byUser: TestComment;
    byEditor: TestComment;
    pending: TestComment;
    replies: TestComment[];
  };
};

export async function seed(): Promise<SeededData> {
  const admin = await asRole("admin");
  const editor = await asRole("editor");
  const moderator = await asRole("moderator");
  const user = await asRole("user");

  // Seed posts
  const postData = [
    {
      authorId: editor.id,
      title: "Test Commentable Post",
      slug: `${TEST_PREFIX}comment-post`,
      status: "published" as const,
      type: "article" as const,
      content: "Post with comments",
      commentEnabled: true,
    },
    {
      authorId: editor.id,
      title: "Test Comments Disabled",
      slug: `${TEST_PREFIX}no-comments-post`,
      status: "published" as const,
      type: "article" as const,
      content: "Comments disabled",
      commentEnabled: false,
    },
    {
      authorId: admin.id,
      title: "Test Draft Post",
      slug: `${TEST_PREFIX}draft-post`,
      status: "draft" as const,
      type: "article" as const,
      content: "Draft content",
    },
  ];

  const posts = await db.insert(schema.posts).values(postData).returning({
    id: schema.posts.id,
    slug: schema.posts.slug,
    authorId: schema.posts.authorId,
  });

  const commentablePostId = posts[0].id;

  // Root comment by user (approved)
  const [byUser] = await db
    .insert(schema.comments)
    .values({
      postId: commentablePostId,
      authorId: user.id,
      content: "Approved comment by user",
      status: "approved",
    })
    .returning({
      id: schema.comments.id,
      postId: schema.comments.postId,
      authorId: schema.comments.authorId,
    });

  // Root comment by editor (approved)
  const [byEditor] = await db
    .insert(schema.comments)
    .values({
      postId: commentablePostId,
      authorId: editor.id,
      content: "Approved comment by editor",
      status: "approved",
    })
    .returning({
      id: schema.comments.id,
      postId: schema.comments.postId,
      authorId: schema.comments.authorId,
    });

  // Root comment (pending — awaiting moderation)
  const [pending] = await db
    .insert(schema.comments)
    .values({
      postId: commentablePostId,
      authorId: user.id,
      content: "Pending comment awaiting moderation",
      status: "pending",
    })
    .returning({
      id: schema.comments.id,
      postId: schema.comments.postId,
      authorId: schema.comments.authorId,
    });

  // Multiple replies to the editor's comment (for pagination testing)
  const replyValues = Array.from({ length: 5 }, (_, i) => ({
    postId: commentablePostId,
    authorId: user.id,
    parentId: byEditor.id,
    content: `Reply ${i + 1} to editor`,
    status: "approved" as const,
  }));

  const replies = await db.insert(schema.comments).values(replyValues).returning({
    id: schema.comments.id,
    postId: schema.comments.postId,
    authorId: schema.comments.authorId,
    parentId: schema.comments.parentId,
  });

  return {
    users: { admin, editor, moderator, user },
    posts,
    comments: {
      byUser: byUser as TestComment,
      byEditor: byEditor as TestComment,
      pending: pending as TestComment,
      replies: replies.map((r) => ({
        ...r,
        parentId: r.parentId!,
      })) as TestComment[],
    },
  };
}

export async function cleanup() {
  const testPostIds = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(like(schema.posts.slug, `${TEST_PREFIX}%`));

  if (testPostIds.length > 0) {
    await db.delete(schema.comments).where(
      inArray(
        schema.comments.postId,
        testPostIds.map((p) => p.id),
      ),
    );
  }

  await db.delete(schema.posts).where(like(schema.posts.slug, `${TEST_PREFIX}%`));
  await db.delete(schema.users).where(like(schema.users.username, `${TEST_PREFIX}%`));
  tokenCache.clear();
}

type RequestOptions = {
  body?: Record<string, any>;
  token?: string;
  query?: Record<string, string>;
};

export const api = {
  get: (path: string, opts?: RequestOptions) => send("GET", path, opts),
  post: (path: string, opts?: RequestOptions) => send("POST", path, opts),
  patch: (path: string, opts?: RequestOptions) => send("PATCH", path, opts),
  delete: (path: string, opts?: RequestOptions) => send("DELETE", path, opts),
};

async function send(method: string, path: string, opts?: RequestOptions): Promise<Response> {
  let url = `${BASE}${path}`;

  if (opts?.query) {
    const params = new URLSearchParams(opts.query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {};
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts?.body) headers["Content-Type"] = "application/json";

  return app.fetch(
    new Request(url, {
      method,
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    }),
  );
}
