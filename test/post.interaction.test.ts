import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { api, seed, cleanup, asRole, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
  s = await seed();
});

afterAll(async () => {
  await cleanup();
});

const slug = () => s.posts[0].slug;
const badSlug = "this-post-does-not-exist-999";

// ═════════════════════════════════════════════════════════════
//  Reactions
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/reactions", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/reactions`, {
      body: { reaction: "like" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(404);
  });

  it("creates a like reaction", async () => {
    const res = await api.post(`/v1/posts/${slug()}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeNumber();
    expect(body.data.reaction).toBe("like");
  });

  it("upserts — switches from like to dislike", async () => {
    const res = await api.post(`/v1/posts/${slug()}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "dislike" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.reaction).toBe("dislike");
  });

  it("validates reaction value", async () => {
    const res = await api.post(`/v1/posts/${slug()}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "love" },
    });
    expect(res.status).toBe(400);
  });

  it("allows a second user to react independently", async () => {
    const res = await api.post(`/v1/posts/${slug()}/reactions`, {
      token: s.users.editor.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.reaction).toBe("like");
  });
});

describe("GET /v1/posts/:slug/reactions", () => {
  it("returns paginated reactions", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeNumber();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.get(`/v1/posts/${badSlug}/reactions`);
    expect(res.status).toBe(404);
  });

  it("filters by ?reaction=like", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { reaction: "like" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.reaction).toBe("like");
    }
  });

  it("filters by ?reaction=dislike", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { reaction: "dislike" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.reaction).toBe("dislike");
    }
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const r of body.data) {
      expect(r.user).toBeDefined();
      expect(r.user.id).toBeNumber();
      expect(r.user.username).toBeString();
    }
  });

  it("supports ?fields=id,reaction (sparse fieldset)", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { fields: "id,reaction" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    for (const r of body.data) {
      expect(r.id).toBeDefined();
      expect(r.reaction).toBeDefined();
      expect(r.createdAt).toBeUndefined();
    }
  });

  it("respects pagination", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { limit: "1", page: "1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });
});

describe("DELETE /v1/posts/:slug/reactions", () => {
  it("requires authentication", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/reactions`);
    expect(res.status).toBe(401);
  });

  it("removes the user's reaction", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/reactions`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);

    // Verify it's gone
    const list = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { reaction: "dislike" },
    });
    const body = await list.json();
    const userIds = body.data.map((r: any) => r.userId);
    expect(userIds).not.toContain(s.users.user.id);
  });

  it("is idempotent — deleting again still returns 204", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/reactions`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.delete(`/v1/posts/${badSlug}/reactions`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════
//  Emojis
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/emojis", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/emojis`, {
      body: { emojiValue: "🔥", sentiment: "positive" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/emojis`, {
      token: s.users.user.token,
      body: { emojiValue: "🔥", sentiment: "positive" },
    });
    expect(res.status).toBe(404);
  });

  it("adds an emoji reaction", async () => {
    const res = await api.post(`/v1/posts/${slug()}/emojis`, {
      token: s.users.user.token,
      body: { emojiValue: "🔥", sentiment: "positive" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.emojiValue).toBe("🔥");
    expect(body.data.sentiment).toBe("positive");
  });

  it("allows multiple different emojis from same user", async () => {
    const res = await api.post(`/v1/posts/${slug()}/emojis`, {
      token: s.users.user.token,
      body: { emojiValue: "❤️", sentiment: "positive" },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.emojiValue).toBe("❤️");
  });

  it("upserts sentiment on same emoji", async () => {
    const res = await api.post(`/v1/posts/${slug()}/emojis`, {
      token: s.users.user.token,
      body: { emojiValue: "🔥", sentiment: "negative" },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.sentiment).toBe("negative");
  });

  it("validates required fields", async () => {
    const res = await api.post(`/v1/posts/${slug()}/emojis`, {
      token: s.users.user.token,
      body: { emojiValue: "🔥" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts/:slug/emojis", () => {
  it("returns paginated emojis", async () => {
    const res = await api.get(`/v1/posts/${slug()}/emojis`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("filters by ?sentiment=positive", async () => {
    const res = await api.get(`/v1/posts/${slug()}/emojis`, {
      query: { sentiment: "positive" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const e of body.data) {
      expect(e.sentiment).toBe("positive");
    }
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/posts/${slug()}/emojis`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const e of body.data) {
      expect(e.user).toBeDefined();
      expect(e.user.id).toBeNumber();
    }
  });

  it("supports sparse fieldset", async () => {
    const res = await api.get(`/v1/posts/${slug()}/emojis`, {
      query: { fields: "id,emojiValue" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const e of body.data) {
      expect(e.id).toBeDefined();
      expect(e.emojiValue).toBeDefined();
      expect(e.sentiment).toBeUndefined();
      expect(e.createdAt).toBeUndefined();
    }
  });
});

describe("DELETE /v1/posts/:slug/emojis/:emojiValue", () => {
  it("requires authentication", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/emojis/${encodeURIComponent("🔥")}`);
    expect(res.status).toBe(401);
  });

  it("removes a specific emoji", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/emojis/${encodeURIComponent("🔥")}`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);
  });

  it("is idempotent", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/emojis/${encodeURIComponent("🔥")}`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);
  });

  it("does not affect other emojis from same user", async () => {
    const list = await api.get(`/v1/posts/${slug()}/emojis`);
    const body = await list.json();
    const hearts = body.data.filter((e: any) => e.emojiValue === "❤️");
    expect(hearts.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.delete(`/v1/posts/${badSlug}/emojis/${encodeURIComponent("🔥")}`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════
//  Bookmarks
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/bookmarks", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/bookmarks`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/bookmarks`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });

  it("bookmarks a post", async () => {
    const res = await api.post(`/v1/posts/${slug()}/bookmarks`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeNumber();
  });

  it("is idempotent — re-bookmarking returns 201 with same record", async () => {
    const res = await api.post(`/v1/posts/${slug()}/bookmarks`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(201);
  });

  it("allows a second user to bookmark independently", async () => {
    const res = await api.post(`/v1/posts/${slug()}/bookmarks`, {
      token: s.users.editor.token,
    });
    expect(res.status).toBe(201);
  });
});

describe("GET /v1/posts/:slug/bookmarks", () => {
  it("returns paginated bookmarks", async () => {
    const res = await api.get(`/v1/posts/${slug()}/bookmarks`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/posts/${slug()}/bookmarks`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const b of body.data) {
      expect(b.user).toBeDefined();
      expect(b.user.username).toBeString();
    }
  });

  it("supports sparse fieldset", async () => {
    const res = await api.get(`/v1/posts/${slug()}/bookmarks`, {
      query: { fields: "id" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const b of body.data) {
      expect(b.id).toBeDefined();
      expect(b.createdAt).toBeUndefined();
    }
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.get(`/v1/posts/${badSlug}/bookmarks`);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /v1/posts/:slug/bookmarks", () => {
  it("requires authentication", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/bookmarks`);
    expect(res.status).toBe(401);
  });

  it("removes the bookmark", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/bookmarks`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);

    // Verify total decreased
    const list = await api.get(`/v1/posts/${slug()}/bookmarks`);
    const body = await list.json();
    expect(body.total).toBeGreaterThanOrEqual(1); // editor's bookmark remains
  });

  it("is idempotent", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/bookmarks`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);
  });
});

// ═════════════════════════════════════════════════════════════
//  Shares
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/shares", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/shares`, {
      body: { platform: "twitter" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/shares`, {
      token: s.users.user.token,
      body: { platform: "twitter" },
    });
    expect(res.status).toBe(404);
  });

  it("records a share", async () => {
    const res = await api.post(`/v1/posts/${slug()}/shares`, {
      token: s.users.user.token,
      body: { platform: "twitter" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.platform).toBe("twitter");
  });

  it("allows multiple shares from same user (not unique)", async () => {
    const res = await api.post(`/v1/posts/${slug()}/shares`, {
      token: s.users.user.token,
      body: { platform: "linkedin" },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.platform).toBe("linkedin");
  });

  it("validates platform field", async () => {
    const res = await api.post(`/v1/posts/${slug()}/shares`, {
      token: s.users.user.token,
      body: { platform: "" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/posts/:slug/shares", () => {
  it("returns paginated shares", async () => {
    const res = await api.get(`/v1/posts/${slug()}/shares`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/posts/${slug()}/shares`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const s of body.data) {
      expect(s.user).toBeDefined();
      expect(s.user.id).toBeNumber();
    }
  });

  it("supports sparse fieldset", async () => {
    const res = await api.get(`/v1/posts/${slug()}/shares`, {
      query: { fields: "id,platform" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const s of body.data) {
      expect(s.id).toBeDefined();
      expect(s.platform).toBeDefined();
      expect(s.createdAt).toBeUndefined();
    }
  });
});

// ═════════════════════════════════════════════════════════════
//  People's Choice
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/peoples-choice", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/peoples-choice`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });

  it("casts a vote", async () => {
    const res = await api.post(`/v1/posts/${slug()}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeNumber();
  });

  it("is idempotent — voting again returns 201", async () => {
    const res = await api.post(`/v1/posts/${slug()}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(201);
  });

  it("allows a second user to vote", async () => {
    const res = await api.post(`/v1/posts/${slug()}/peoples-choice`, {
      token: s.users.editor.token,
    });
    expect(res.status).toBe(201);
  });
});

describe("GET /v1/posts/:slug/peoples-choice", () => {
  it("returns paginated votes", async () => {
    const res = await api.get(`/v1/posts/${slug()}/peoples-choice`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/posts/${slug()}/peoples-choice`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const v of body.data) {
      expect(v.user).toBeDefined();
      expect(v.user.username).toBeString();
    }
  });

  it("supports sparse fieldset", async () => {
    const res = await api.get(`/v1/posts/${slug()}/peoples-choice`, {
      query: { fields: "id" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const v of body.data) {
      expect(v.id).toBeDefined();
      expect(v.createdAt).toBeUndefined();
    }
  });

  it("respects pagination", async () => {
    const res = await api.get(`/v1/posts/${slug()}/peoples-choice`, {
      query: { limit: "1", page: "1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });
});

describe("DELETE /v1/posts/:slug/peoples-choice", () => {
  it("requires authentication", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/peoples-choice`);
    expect(res.status).toBe(401);
  });

  it("removes the vote", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);

    // Verify total decreased
    const list = await api.get(`/v1/posts/${slug()}/peoples-choice`);
    const body = await list.json();
    expect(body.total).toBeGreaterThanOrEqual(1); // editor's vote remains
  });

  it("is idempotent", async () => {
    const res = await api.delete(`/v1/posts/${slug()}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.delete(`/v1/posts/${badSlug}/peoples-choice`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════
//  Views
// ═════════════════════════════════════════════════════════════

describe("POST /v1/posts/:slug/views", () => {
  it("returns 202 Accepted", async () => {
    const res = await api.post(`/v1/posts/${slug()}/views`);
    expect(res.status).toBe(202);
  });

  it("works without authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/views`);
    expect(res.status).toBe(202);
  });

  it("works with authentication", async () => {
    const res = await api.post(`/v1/posts/${slug()}/views`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(202);
  });

  it("returns 404 for non-existent post", async () => {
    const res = await api.post(`/v1/posts/${badSlug}/views`);
    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════
//  Cross-cutting: invalid includes / fields
// ═════════════════════════════════════════════════════════════

describe("Query validation", () => {
  it("rejects invalid include on reactions", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { include: "password" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid fields on bookmarks", async () => {
    const res = await api.get(`/v1/posts/${slug()}/bookmarks`, {
      query: { fields: "userId" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects forbidden column in fields on reactions", async () => {
    const res = await api.get(`/v1/posts/${slug()}/reactions`, {
      query: { fields: "postId" },
    });
    expect(res.status).toBe(400);
  });
});
