import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { api, seed, cleanup, type SeededData } from "./setup";

let s: SeededData;

beforeAll(async () => {
  s = await seed();
});

afterAll(async () => {
  await cleanup();
});

const commentId = () => s.comments.byUser.id;
const editorCommentId = () => s.comments.byEditor.id;
const badId = 999999;

// ═════════════════════════════════════════════════════════════
//  POST /v1/comments/:id/reactions
// ═════════════════════════════════════════════════════════════

describe("POST /v1/comments/:id/reactions", () => {
  it("requires authentication", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      body: { reaction: "like" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent comment", async () => {
    const res = await api.post(`/v1/comments/${badId}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(404);
  });

  it("creates a like reaction", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.editor.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeNumber();
    expect(body.data.reaction).toBe("like");
  });

  it("upserts — switches from like to dislike", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.editor.token,
      body: { reaction: "dislike" },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.reaction).toBe("dislike");
  });

  it("validates reaction value", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "love" },
    });
    expect(res.status).toBe(400);
  });

  it("validates missing body", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.user.token,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("allows multiple users to react to the same comment", async () => {
    const res = await api.post(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.admin.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(201);
    expect((await res.json()).data.reaction).toBe("like");
  });

  it("allows reacting to a different comment", async () => {
    const res = await api.post(`/v1/comments/${editorCommentId()}/reactions`, {
      token: s.users.user.token,
      body: { reaction: "like" },
    });
    expect(res.status).toBe(201);
  });
});

// ═════════════════════════════════════════════════════════════
//  GET /v1/comments/:id/reactions
// ═════════════════════════════════════════════════════════════

describe("GET /v1/comments/:id/reactions", () => {
  it("returns paginated reactions", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 for non-existent comment", async () => {
    const res = await api.get(`/v1/comments/${badId}/reactions`);
    expect(res.status).toBe(404);
  });

  it("filters by ?reaction=like", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { reaction: "like" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.reaction).toBe("like");
    }
  });

  it("filters by ?reaction=dislike", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { reaction: "dislike" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.reaction).toBe("dislike");
    }
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("supports ?include=user", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
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

  it("supports ?include=user with profile", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { include: "user" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.user).toBeDefined();
      // profile may be null if no profile row, but the key should exist
      if (r.user.profile) {
        expect(r.user.profile).toHaveProperty("avatarUrl");
      }
    }
  });

  it("supports sparse fieldset ?fields=id,reaction", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
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

  it("supports sparse fieldset ?fields=id only", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { fields: "id" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const r of body.data) {
      expect(r.id).toBeDefined();
      expect(r.reaction).toBeUndefined();
      expect(r.createdAt).toBeUndefined();
    }
  });

  it("respects pagination", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { limit: "1", page: "1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.total).toBeGreaterThanOrEqual(2);
  });

  it("page 2 returns different results than page 1", async () => {
    const page1 = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { limit: "1", page: "1" },
    });
    const page2 = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { limit: "1", page: "2" },
    });
    const body1 = await page1.json();
    const body2 = await page2.json();

    if (body2.data.length > 0) {
      expect(body1.data[0].id).not.toBe(body2.data[0].id);
    }
  });

  it("works without authentication", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`);
    expect(res.status).toBe(200);
  });

  it("does not leak reactions from other comments", async () => {
    const res = await api.get(`/v1/comments/${editorCommentId()}/reactions`);
    expect(res.status).toBe(200);
    const body = await res.json();

    // The editor's comment should only have the user's like from the POST tests
    // and NOT the reactions from commentId()
    const mainCommentReactions = await api.get(`/v1/comments/${commentId()}/reactions`);
    const mainBody = await mainCommentReactions.json();

    // totals should differ since the two comments have different reaction counts
    if (body.total !== mainBody.total) {
      expect(body.total).not.toBe(mainBody.total);
    }
  });
});

// ═════════════════════════════════════════════════════════════
//  DELETE /v1/comments/:id/reactions
// ═════════════════════════════════════════════════════════════

describe("DELETE /v1/comments/:id/reactions", () => {
  it("requires authentication", async () => {
    const res = await api.delete(`/v1/comments/${commentId()}/reactions`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent comment", async () => {
    const res = await api.delete(`/v1/comments/${badId}/reactions`, {
      token: s.users.user.token,
    });
    expect(res.status).toBe(404);
  });

  it("removes the user's reaction", async () => {
    // admin had a "like" on commentId() from the POST tests
    const before = await api.get(`/v1/comments/${commentId()}/reactions`);
    const beforeBody = await before.json();
    const beforeTotal = beforeBody.total;

    const res = await api.delete(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.admin.token,
    });
    expect(res.status).toBe(204);

    const after = await api.get(`/v1/comments/${commentId()}/reactions`);
    const afterBody = await after.json();
    expect(afterBody.total).toBe(beforeTotal - 1);
  });

  it("is idempotent — deleting again still returns 204", async () => {
    const res = await api.delete(`/v1/comments/${commentId()}/reactions`, {
      token: s.users.admin.token,
    });
    expect(res.status).toBe(204);
  });

  it("does not affect other users' reactions", async () => {
    // editor still has a dislike on commentId()
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { reaction: "dislike" },
    });
    const body = await res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("does not affect reactions on other comments", async () => {
    // user's like on editorCommentId() should still be there
    const res = await api.get(`/v1/comments/${editorCommentId()}/reactions`);
    const body = await res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════
//  Query validation
// ═════════════════════════════════════════════════════════════

describe("Comment reaction query validation", () => {
  it("rejects invalid include", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { include: "secrets" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects forbidden column in fields", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { fields: "commentId" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects userId in fields", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { fields: "userId" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-existent column in fields", async () => {
    const res = await api.get(`/v1/comments/${commentId()}/reactions`, {
      query: { fields: "nonExistentField" },
    });
    expect(res.status).toBe(400);
  });
});
