/**
 * Test setup and helpers.
 *
 * Provides:
 *   - Token generation for any role
 *   - Test data seeding / cleanup
 *   - A thin `api()` wrapper around app.fetch()
 *
 * Usage:
 *   import { api, seed, cleanup, tokens } from './setup';
 */

import { generateAccessToken } from '$src/lib/jwt';
import { db } from '$src/db/client';
import * as schema from '$src/db/schema';
import { eq, like } from 'drizzle-orm';
import type { Role } from '$src/db/schema/types';
import app from '$src/index';

const BASE = 'http://localhost:3000';

const TEST_PREFIX = 'test-';

type TestUser = {
    id: number;
    token: string;
    email: string;
    username: string;
    role: Role;
};

const tokenCache = new Map<string, TestUser>();

/**
 * Returns a test user with a valid JWT for the given role.
 * Creates the user in the DB on first call, caches for subsequent calls.
 *
 * ```ts
 * const admin = await asRole('admin');
 * const res = await api.post('/api/v1/posts', { body, token: admin.token });
 * ```
 */
export async function asRole(role: Role): Promise<TestUser> {
    if (tokenCache.has(role)) return tokenCache.get(role)!;

    const username = `${TEST_PREFIX}${role}`;
    const email = `${username}@test.local`;
    const password = 'testpass';

    let [user] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);

    if (!user) {
        const hash = await Bun.password.hash(password, { algorithm: 'argon2id', memoryCost: 4096, timeCost: 1 });
        [user] = await db.insert(schema.users).values({
            username,
            email,
            passwordHash: hash,
            role,
            isActivated: true,
        }).returning({ id: schema.users.id });
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
    users: { admin: TestUser; editor: TestUser; user: TestUser };
    posts: { id: number; slug: string; authorId: number }[];
};

/**
 * Seeds the minimum data needed for post tests.
 * Call in `beforeAll`.
 */
export async function seed(): Promise<SeededData> {
    const admin = await asRole('admin');
    const editor = await asRole('editor');
    const user = await asRole('user');

    const postData = [
        { authorId: user.id, title: 'Test User Post', slug: `${TEST_PREFIX}user-post`, status: 'published' as const, type: 'article' as const, content: 'User content' },
        { authorId: editor.id, title: 'Test Editor Post', slug: `${TEST_PREFIX}editor-post`, status: 'published' as const, type: 'news' as const, content: 'Editor content' },
        { authorId: admin.id, title: 'Test Draft Post', slug: `${TEST_PREFIX}draft-post`, status: 'draft' as const, type: 'article' as const, content: 'Draft content' },
    ];

    const posts = await db.insert(schema.posts).values(postData).returning({
        id: schema.posts.id,
        slug: schema.posts.slug,
        authorId: schema.posts.authorId,
    });

    return {
        users: { admin, editor, user },
        posts,
    };
}

/**
 * Removes all test data. Call in `afterAll`.
 */
export async function cleanup() {
    await db.delete(schema.posts).where(like(schema.posts.slug, `${TEST_PREFIX}%`));
    await db.delete(schema.users).where(like(schema.users.username, `${TEST_PREFIX}%`));
    tokenCache.clear();
}

type RequestOptions = {
    body?: Record<string, any>;
    token?: string;
    query?: Record<string, string>;
};

/**
 * Thin wrapper around app.fetch(). Returns the Response directly.
 *
 * ```ts
 * const res = await api.get('/api/v1/posts?limit=5');
 * const res = await api.post('/api/v1/posts', { body: { title: 'Hi' }, token });
 * const res = await api.patch('/api/v1/posts/my-slug', { body: { title: 'New' }, token });
 * const res = await api.delete('/api/v1/posts/my-slug', { token });
 * ```
 */
export const api = {
    get: (path: string, opts?: RequestOptions) => send('GET', path, opts),
    post: (path: string, opts?: RequestOptions) => send('POST', path, opts),
    patch: (path: string, opts?: RequestOptions) => send('PATCH', path, opts),
    delete: (path: string, opts?: RequestOptions) => send('DELETE', path, opts),
};

async function send(method: string, path: string, opts?: RequestOptions): Promise<Response> {
    let url = `${BASE}${path}`;

    if (opts?.query) {
        const params = new URLSearchParams(opts.query);
        url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {};
    if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (opts?.body) headers['Content-Type'] = 'application/json';

    return app.fetch(new Request(url, {
        method,
        headers,
        body: opts?.body ? JSON.stringify(opts.body) : undefined,
    }));
}

