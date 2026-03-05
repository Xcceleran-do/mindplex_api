import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { api, seed, cleanup, asRole, type SeededData } from './setup';

let s: SeededData;

beforeAll(async () => {
    s = await seed();
});

afterAll(async () => {
    await cleanup();
});


// ─── GET /v1/posts/:identifier/comments ─────────────────

describe('GET /v1/posts/:identifier/comments', () => {
    it('returns approved root comments by default', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArray();

        for (const comment of body.data) {
            expect(comment.parentId ?? null).toBeNull();
            expect(comment.status).toBe('approved');
        }
    });

    it('does not include replies in root listing', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`);

        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = body.data.map((c: any) => c.id);

        for (const reply of s.comments.replies) {
            expect(ids).not.toContain(reply.id);
        }
    });

    it('can filter by ?status=pending', async () => {
        const { token } = s.users.moderator;
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`, {
            query: { status: 'pending' },
            token,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeGreaterThan(0);
        for (const comment of body.data) {
            expect(comment.status).toBe('pending');
            expect(comment.parentId ?? null).toBeNull();
        }
    });

    it('respects ?limit and ?page', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`, {
            query: { limit: '1', page: '1' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(1);
    });

    it('respects ?fields to prune response', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`, {
            query: { fields: 'id,content' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const comment = body.data[0];
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('content');
        expect(comment).not.toHaveProperty('status');
    });

    it('respects ?include=author', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`, {
            query: { include: 'author' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const comment = body.data[0];
        expect(comment).toHaveProperty('author');
        expect(comment.author).toHaveProperty('id');
        expect(comment.author).toHaveProperty('username');
    });

    it('does not include author by default', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`);

        expect(res.status).toBe(200);
        const body = await res.json();
        const comment = body.data[0];
        expect(comment).not.toHaveProperty('author');
    });

    it('rejects invalid include', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}/comments`, {
            query: { include: 'secrets' },
        });

        expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent post', async () => {
        const res = await api.get('/v1/posts/non-existent-slug/comments');

        expect(res.status).toBe(404);
    });

    it('returns empty array when post has no approved comments', async () => {
        // posts[2] is the draft post with no comments
        const res = await api.get(`/v1/posts/${s.posts[2].slug}/comments`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArrayOfSize(0);
    });
});


// ─── POST /v1/posts/:identifier/comments ────────────────

describe('POST /v1/posts/:identifier/comments', () => {
    it('creates a comment as authenticated user (status = pending)', async () => {
        const { token } = s.users.user;
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'A new pending comment' },
            token,
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.content).toBe('A new pending comment');
        expect(body.data.status).toBe('pending');
        expect(body.data.postId).toBe(s.posts[0].id);
    });

    it('creates a reply with parentId', async () => {
        const { token } = s.users.user;
        const parentId = s.comments.byEditor.id;

        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'A reply via test', parentId },
            token,
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.parentId).toBe(parentId);
        expect(body.data.status).toBe('pending');
    });

    it('any role gets pending status (even admin)', async () => {
        const { token } = s.users.admin;
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'Admin comment still pending' },
            token,
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.status).toBe('pending');
    });

    it('returns 401 without auth', async () => {
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'No auth' },
        });

        expect(res.status).toBe(401);
    });

    it('returns 403 when comments are disabled on the post', async () => {
        const { token } = s.users.user;
        const res = await api.post(`/v1/posts/${s.posts[1].slug}/comments`, {
            body: { content: 'Should fail' },
            token,
        });

        expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent post', async () => {
        const { token } = s.users.user;
        const res = await api.post('/v1/posts/does-not-exist/comments', {
            body: { content: 'Orphan comment' },
            token,
        });

        expect(res.status).toBe(404);
    });

    it('returns 404 when parentId does not exist on this post', async () => {
        const { token } = s.users.user;
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'Bad parent', parentId: 999999 },
            token,
        });

        expect(res.status).toBe(404);
    });

    it('validates content is required', async () => {
        const { token } = s.users.user;
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: '' },
            token,
        });

        expect(res.status).toBe(400);
    });

    it('validates content max length', async () => {
        const { token } = s.users.user;
        const res = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'x'.repeat(10001) },
            token,
        });

        expect(res.status).toBe(400);
    });
});


// ─── GET /v1/comments/:id/replies ───────────────────────

describe('GET /v1/comments/:id/replies', () => {
    it('returns paginated replies for a comment', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArray();
        expect(body.data.length).toBeGreaterThan(0);

        for (const reply of body.data) {
            expect(reply.parentId).toBe(parentId);
        }
    });

    it('only returns approved replies by default', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`);

        expect(res.status).toBe(200);
        const body = await res.json();
        for (const reply of body.data) {
            expect(reply.status).toBe('approved');
        }
    });

    it('respects ?limit and ?page', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { limit: '2', page: '1' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(2);
    });

    it('paginates correctly across pages', async () => {
        const parentId = s.comments.byEditor.id;

        const page1 = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { limit: '2', page: '1' },
        });
        const page2 = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { limit: '2', page: '2' },
        });

        const body1 = await page1.json();
        const body2 = await page2.json();

        const ids1 = body1.data.map((c: any) => c.id);
        const ids2 = body2.data.map((c: any) => c.id);

        for (const id of ids2) {
            expect(ids1).not.toContain(id);
        }
    });

    it('respects ?fields to prune response', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { fields: 'id,content' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const reply = body.data[0];
        expect(reply).toHaveProperty('id');
        expect(reply).toHaveProperty('content');
        expect(reply).not.toHaveProperty('status');
    });

    it('respects ?include=author', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { include: 'author' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        const reply = body.data[0];
        expect(reply).toHaveProperty('author');
        expect(reply.author).toHaveProperty('id');
        expect(reply.author).toHaveProperty('username');
    });

    it('does not include author by default', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`);

        expect(res.status).toBe(200);
        const body = await res.json();
        const reply = body.data[0];
        expect(reply).not.toHaveProperty('author');
    });

    it('rejects invalid include', async () => {
        const parentId = s.comments.byEditor.id;
        const res = await api.get(`/v1/comments/${parentId}/replies`, {
            query: { include: 'secrets' },
        });

        expect(res.status).toBe(400);
    });

    it('returns empty array for comment with no replies', async () => {
        const commentId = s.comments.byUser.id;
        const res = await api.get(`/v1/comments/${commentId}/replies`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArrayOfSize(0);
    });

    it('returns 404 for non-existent comment', async () => {
        const res = await api.get('/v1/comments/999999/replies');

        expect(res.status).toBe(404);
    });
});


// ─── PATCH /v1/comments/:id ─────────────────────────────

describe('PATCH /v1/comments/:id', () => {
    it('allows the author to edit their comment', async () => {
        const { token } = s.users.user;
        const commentId = s.comments.byUser.id;

        const res = await api.patch(`/v1/comments/${commentId}`, {
            body: { content: 'Edited by author' },
            token,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.content).toBe('Edited by author');
    });

    it('allows a moderator to edit any comment', async () => {
        const { token } = s.users.moderator;
        const commentId = s.comments.byUser.id;

        const res = await api.patch(`/v1/comments/${commentId}`, {
            body: { content: 'Edited by moderator' },
            token,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.content).toBe('Edited by moderator');
    });

    it('allows an admin to edit any comment', async () => {
        const { token } = s.users.admin;
        const commentId = s.comments.byEditor.id;

        const res = await api.patch(`/v1/comments/${commentId}`, {
            body: { content: 'Edited by admin' },
            token,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.content).toBe('Edited by admin');
    });

    it('forbids editing another user\'s comment', async () => {
        const { token } = s.users.user;
        const commentId = s.comments.byEditor.id;

        const res = await api.patch(`/v1/comments/${commentId}`, {
            body: { content: 'Hijack attempt' },
            token,
        });

        expect(res.status).toBe(403);
    });

    it('allows editing a reply (same rules as root comment)', async () => {
        const { token } = s.users.user;
        const replyId = s.comments.replies[0].id;

        const res = await api.patch(`/v1/comments/${replyId}`, {
            body: { content: 'Edited reply' },
            token,
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.content).toBe('Edited reply');
    });

    it('returns 401 without auth', async () => {
        const res = await api.patch(`/v1/comments/${s.comments.byUser.id}`, {
            body: { content: 'No auth' },
        });

        expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent comment', async () => {
        const { token } = s.users.user;
        const res = await api.patch('/v1/comments/999999', {
            body: { content: 'Ghost' },
            token,
        });

        expect(res.status).toBe(404);
    });

    it('validates content is not empty', async () => {
        const { token } = s.users.user;
        const res = await api.patch(`/v1/comments/${s.comments.byUser.id}`, {
            body: { content: '' },
            token,
        });

        expect(res.status).toBe(400);
    });

    it('validates content max length', async () => {
        const { token } = s.users.user;
        const res = await api.patch(`/v1/comments/${s.comments.byUser.id}`, {
            body: { content: 'x'.repeat(10001) },
            token,
        });

        expect(res.status).toBe(400);
    });
});


// ─── DELETE /v1/comments/:id ────────────────────────────

describe('DELETE /v1/comments/:id', () => {
    it('allows the author to delete their comment', async () => {
        const { token } = s.users.user;
        const created = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'To be deleted by author' },
            token,
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/comments/${id}`, { token });
        expect(res.status).toBe(204);

        const check = await api.patch(`/v1/comments/${id}`, {
            body: { content: 'Still here?' },
            token,
        });
        expect(check.status).toBe(404);
    });

    it('allows a moderator to delete any comment', async () => {
        const { token: userToken } = s.users.user;
        const { token: modToken } = s.users.moderator;

        const created = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'To be deleted by mod' },
            token: userToken,
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/comments/${id}`, { token: modToken });
        expect(res.status).toBe(204);
    });

    it('allows an admin to delete any comment', async () => {
        const { token: userToken } = s.users.user;
        const { token: adminToken } = s.users.admin;

        const created = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'To be deleted by admin' },
            token: userToken,
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/comments/${id}`, { token: adminToken });
        expect(res.status).toBe(204);
    });

    it('allows deleting a reply', async () => {
        const { token } = s.users.user;
        const parentId = s.comments.byEditor.id;

        const created = await api.post(`/v1/posts/${s.posts[0].slug}/comments`, {
            body: { content: 'Reply to be deleted', parentId },
            token,
        });
        const { id } = (await created.json()).data;

        const res = await api.delete(`/v1/comments/${id}`, { token });
        expect(res.status).toBe(204);
    });

    it('forbids deleting another user\'s comment', async () => {
        const { token } = s.users.user;
        const commentId = s.comments.byEditor.id;

        const res = await api.delete(`/v1/comments/${commentId}`, { token });
        expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
        const res = await api.delete(`/v1/comments/${s.comments.byUser.id}`);
        expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent comment', async () => {
        const { token } = s.users.admin;
        const res = await api.delete('/v1/comments/999999', { token });
        expect(res.status).toBe(404);
    });
});