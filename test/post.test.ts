import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { api, seed, cleanup, asRole, type SeededData } from './setup';

let s: SeededData;

beforeAll(async () => {
    s = await seed();
});

afterAll(async () => {
    await cleanup();
});


// ─── GET /v1/posts ──────────────────────────────────────

describe('GET /v1/posts', () => {
    it('returns a list of posts', async () => {
        const res = await api.get('/v1/posts');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeArray();
    });

    it('respects ?limit and ?page', async () => {
        const res = await api.get('/v1/posts', { query: { limit: '1', page: '1' } });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.length).toBeLessThanOrEqual(1);
    });

    it('respects ?fields to prune response', async () => {
        const res = await api.get('/v1/posts', { query: { fields: 'id,title' } });

        expect(res.status).toBe(200);
        const body = await res.json();
        const post = body.data[0];
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('title');
        expect(post).not.toHaveProperty('content');
    });

    it('respects ?include=authors', async () => {
        const res = await api.get('/v1/posts', { query: { include: 'authors' } });

        expect(res.status).toBe(200);
        const body = await res.json();
        const post = body.data[0];
        expect(post).toHaveProperty('author');
    });

    it('rejects invalid include', async () => {
        const res = await api.get('/v1/posts', { query: { include: 'secrets' } });

        expect(res.status).toBe(400);
    });
});


// ─── GET /v1/posts/:identifier ──────────────────────────

describe('GET /v1/posts/:identifier', () => {
    it('finds a post by slug', async () => {
        const slug = s.posts[0].slug;
        const res = await api.get(`/v1/posts/${slug}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.slug).toBe(slug);
    });

    it('finds a post by numeric ID', async () => {
        const id = s.posts[0].id;
        const res = await api.get(`/v1/posts/${id}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.id).toBe(id);
    });

    it('returns 404 for non-existent slug', async () => {
        const res = await api.get('/v1/posts/this-slug-does-not-exist-xyz');

        expect(res.status).toBe(404);
    });

    it('works without auth (public)', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}`);

        expect(res.status).toBe(200);
    });

    it('works with auth (optional)', async () => {
        const res = await api.get(`/v1/posts/${s.posts[0].slug}`, {
            token: s.users.user.token,
        });

        expect(res.status).toBe(200);
    });
});


// ─── POST /v1/posts ─────────────────────────────────────

describe('POST /v1/posts', () => {
    const createdSlugs: string[] = [];

    afterAll(async () => {
        for (const slug of createdSlugs) {
            await api.delete(`/v1/posts/${slug}`, { token: s.users.admin.token });
        }
    });

    it('requires auth', async () => {
        const res = await api.post('/v1/posts', {
            body: { title: 'No Auth Post' },
        });

        expect(res.status).toBe(401);
    });

    it('rejects user role (below editor)', async () => {
        const res = await api.post('/v1/posts', {
            token: s.users.user.token,
            body: { title: 'Not Allowed' },
        });

        expect(res.status).toBe(403);
    });

    it('creates a post with auto-generated slug', async () => {
        const res = await api.post('/v1/posts', {
            token: s.users.editor.token,
            body: { title: 'My Test Post' },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.title).toBe('My Test Post');
        expect(body.data.slug).toBeString();
        expect(body.data.status).toBe('draft');
        createdSlugs.push(body.data.slug);
    });

    it('creates a post with explicit slug', async () => {
        const slug = 'test-explicit-slug-post';
        const res = await api.post('/v1/posts', {
            token: s.users.editor.token,
            body: { title: 'Explicit Slug', slug },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.slug).toBe(slug);
        createdSlugs.push(slug);
    });

    it('rejects duplicate slug', async () => {
        const slug = s.posts[0].slug;
        const res = await api.post('/v1/posts', {
            token: s.users.editor.token,
            body: { title: 'Dupe', slug },
        });

        expect(res.status).toBe(409);
    });

    it('validates required fields', async () => {
        const res = await api.post('/v1/posts', {
            token: s.users.editor.token,
            body: {},
        });

        expect(res.status).toBe(400);
    });

    it('auto-stamps publishedAt when status is published', async () => {
        const res = await api.post('/v1/posts', {
            token: s.users.editor.token,
            body: { title: 'Published Post', status: 'published' },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.publishedAt).toBeTruthy();
        createdSlugs.push(body.data.slug);
    });
});


// ─── PATCH /v1/posts/:identifier ────────────────────────

describe('PATCH /v1/posts/:identifier', () => {
    it('requires auth', async () => {
        const res = await api.patch(`/v1/posts/${s.posts[0].slug}`, {
            body: { title: 'Nope' },
        });

        expect(res.status).toBe(401);
    });

    it('rejects user role (below editor)', async () => {
        const slug = s.posts[0].slug;
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.user.token,
            body: { title: 'Not Allowed' },
        });

        expect(res.status).toBe(403);
    });

    it('owner (editor) can update their post', async () => {
        const slug = s.posts[1].slug;  // owned by editor
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.editor.token,
            body: { title: 'Updated Title' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.title).toBe('Updated Title');
    });

    it('non-owner editor gets 403', async () => {
        const slug = s.posts[2].slug;
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.editor.token,
            body: { title: 'Hijack' },
        });

        expect(res.status).toBe(403);
    });

    it('admin can update any post', async () => {
        const slug = s.posts[1].slug;
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.admin.token,
            body: { title: 'Admin Override' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.title).toBe('Admin Override');
    });

    it('returns 404 for non-existent slug', async () => {
        const res = await api.patch('/v1/posts/ghost-slug-xyz', {
            token: s.users.admin.token,
            body: { title: 'Nope' },
        });

        expect(res.status).toBe(404);
    });

    it('rejects empty update body', async () => {
        const slug = s.posts[1].slug;
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.editor.token,
            body: {},
        });

        expect(res.status).toBe(400);
    });

    it('ignores non-updatable fields like authorId', async () => {
        const slug = s.posts[1].slug;
        const res = await api.patch(`/v1/posts/${slug}`, {
            token: s.users.editor.token,
            body: { title: 'Good Update', authorId: 9999 },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.authorId).not.toBe(9999);
    });
});


// ─── DELETE /v1/posts/:identifier ───────────────────────

describe('DELETE /v1/posts/:identifier', () => {
    it('requires auth', async () => {
        const res = await api.delete(`/v1/posts/${s.posts[2].slug}`);

        expect(res.status).toBe(401);
    });

    it('non-owner gets 403', async () => {
        const slug = s.posts[1].slug;
        const res = await api.delete(`/v1/posts/${slug}`, {
            token: s.users.user.token,
        });

        expect(res.status).toBe(403);
    });

    it('owner can trash their post', async () => {
        const slug = s.posts[2].slug;
        const res = await api.delete(`/v1/posts/${slug}`, {
            token: s.users.admin.token,
        });

        expect(res.status).toBe(204);

        const check = await api.get(`/v1/posts/${slug}`);
        const body = await check.json();
        expect(body.data.status).toBe('trashed');
    });

    it('returns 404 for non-existent slug', async () => {
        const res = await api.delete('/v1/posts/ghost-slug-xyz', {
            token: s.users.admin.token,
        });

        expect(res.status).toBe(404);
    });
});