import { createMiddleware } from 'hono/factory';
import { env } from '$env';
import type { AppContext } from '$src/types';

export const wordpressProxy = createMiddleware<AppContext>(async (c) => {
    const basePath = env.WP_API_BASE_URL.replace(/\/$/, '');
    const targetString = `${basePath}${c.req.path}${new URL(c.req.url).search}`;
    const targetUrl = new URL(targetString);

    const headers = new Headers(c.req.raw.headers);

    headers.set('X-Forwarded-For', c.req.header('x-forwarded-for') || '');
    headers.set('X-Forwarded-Host', c.req.header('host') || '');
    headers.set('X-Forwarded-Proto', 'https');

    headers.delete('host');

    headers.delete('connection');
    headers.delete('keep-alive');
    headers.delete('transfer-encoding');

    try {
        const response = await fetch(targetUrl.toString(), {
            method: c.req.method,
            headers,
            body: ['GET', 'HEAD'].includes(c.req.method) ? null : c.req.raw.body,
            redirect: 'manual',
        });

        const responseHeaders = new Headers(response.headers);
        responseHeaders.delete('transfer-encoding');
        responseHeaders.set('X-Served-By', 'wordpress');


        c.set('debugData', { proxiedTo: targetUrl.toString(), wpStatus: response.status });

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error(`[PROXY] Failed to reach WordPress: ${targetUrl}`, error);
        return c.json({ error: 'Upstream service unavailable' }, 502);
    }
});