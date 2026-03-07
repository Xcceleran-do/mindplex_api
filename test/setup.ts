import { generateAccessToken } from "$src/lib/jwt";
import { db } from "$src/db/client";
import * as schema from "$src/db/schema";
import { eq, inArray, like } from "drizzle-orm";
import type { Role } from "$src/db/schema/types";
import app from "$src/index";
import {
  TEST_PREFIX,
  USER_ROLES,
  POSTS,
  COMMENTS,
  REACTIONS,
  PEOPLES_CHOICE_VOTES,
} from "./seed";

const BASE = "http://localhost:3000";

// ─── Types ──────────────────────────────────────────────

export type TestUser = {
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

export type SeededData = {
  users: Record<"admin" | "editor" | "moderator" | "user", TestUser>;
  posts: { id: number; slug: string; authorId: number }[];
  comments: {
    byUser: TestComment;
    byEditor: TestComment;
    pending: TestComment;
    replies: TestComment[];
  };
};

// ─── User Creation ──────────────────────────────────────

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
      .values({ username, email, passwordHash: hash, role, isActivated: true })
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

// ─── Seed ───────────────────────────────────────────────

export async function seed(): Promise<SeededData> {
  // 1. Users
  const [admin, editor, moderator, user] = await Promise.all(
    USER_ROLES.map((role) => asRole(role)),
  );
  const users = { admin, editor, moderator, user };
  const usersByRole: Record<string, TestUser> = users;

  // 2. Posts
  const postValues = POSTS.map((p) => ({
    authorId: usersByRole[p.authorRole].id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    type: p.type,
    content: p.content,
    commentEnabled: p.commentEnabled,
    isEditorsPick: p.isEditorsPick,
    publishedAt: p.publishedAt,
  }));

  const posts = await db.insert(schema.posts).values(postValues).returning({
    id: schema.posts.id,
    slug: schema.posts.slug,
    authorId: schema.posts.authorId,
  });

  const postsBySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

  // 3. Comments (inserted in order so parent refs resolve)
  const commentsByKey: Record<string, TestComment> = {};

  // Root comments first, then replies
  const roots = COMMENTS.filter((c) => !c.parentKey);
  const replies = COMMENTS.filter((c) => c.parentKey);

  for (const c of roots) {
    const post = postsBySlug[c.postSlug];
    const [inserted] = await db
      .insert(schema.comments)
      .values({
        postId: post.id,
        authorId: usersByRole[c.authorRole].id,
        content: c.content,
        status: c.status,
      })
      .returning({
        id: schema.comments.id,
        postId: schema.comments.postId,
        authorId: schema.comments.authorId,
      });

    commentsByKey[c.key] = inserted as TestComment;
  }

  const replyRecords: TestComment[] = [];
  for (const c of replies) {
    const post = postsBySlug[c.postSlug];
    const parent = commentsByKey[c.parentKey!];
    const [inserted] = await db
      .insert(schema.comments)
      .values({
        postId: post.id,
        authorId: usersByRole[c.authorRole].id,
        content: c.content,
        status: c.status,
        parentId: parent.id,
      })
      .returning({
        id: schema.comments.id,
        postId: schema.comments.postId,
        authorId: schema.comments.authorId,
        parentId: schema.comments.parentId,
      });

    replyRecords.push({ ...inserted, parentId: inserted.parentId! } as TestComment);
  }

  // 4. Reactions
  if (REACTIONS.length > 0) {
    const reactionValues = REACTIONS.map((r) => ({
      postId: postsBySlug[r.postSlug].id,
      userId: usersByRole[r.userRole].id,
      reaction: r.reaction,
    }));
    await db.insert(schema.postReactions).values(reactionValues);
  }

  // 5. People's Choice Votes
  if (PEOPLES_CHOICE_VOTES.length > 0) {
    const voteValues = PEOPLES_CHOICE_VOTES.map((v) => ({
      postId: postsBySlug[v.postSlug].id,
      userId: usersByRole[v.userRole].id,
    }));
    await db.insert(schema.peoplesChoiceVotes).values(voteValues);
  }

  return {
    users,
    posts,
    comments: {
      byUser: commentsByKey["byUser"],
      byEditor: commentsByKey["byEditor"],
      pending: commentsByKey["pending"],
      replies: replyRecords,
    },
  };
}

// ─── Cleanup ────────────────────────────────────────────

export async function cleanup() {
  const testPostIds = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(like(schema.posts.slug, `${TEST_PREFIX}%`));

  const ids = testPostIds.map((p) => p.id);

  if (ids.length > 0) {
    await db.delete(schema.postReactions).where(inArray(schema.postReactions.postId, ids));
    await db.delete(schema.peoplesChoiceVotes).where(inArray(schema.peoplesChoiceVotes.postId, ids));
    await db.delete(schema.postStats).where(inArray(schema.postStats.postId, ids));
    await db.delete(schema.comments).where(inArray(schema.comments.postId, ids));
  }

  await db.delete(schema.posts).where(like(schema.posts.slug, `${TEST_PREFIX}%`));
  await db.delete(schema.users).where(like(schema.users.username, `${TEST_PREFIX}%`));
  tokenCache.clear();
}

// ─── API Client ─────────────────────────────────────────

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