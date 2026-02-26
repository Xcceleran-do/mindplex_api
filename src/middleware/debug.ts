import { createMiddleware } from 'hono/factory';
import { env } from '$env';
import type { AppContext } from '$src/types';

export const debugMode = createMiddleware<AppContext>(async (c, next) => {
    c.set('debugData', {});
    const start = performance.now();
    await next();

    if (env.NODE_ENV === 'development') {
        const debugData = c.get('debugData');
        const ms = performance.now() - start;

        console.log(`[DEBUG] ${c.req.method} ${c.req.path} - ${ms.toFixed(2)}ms`);

        if (Object.keys(debugData).length > 0 && c.res.headers.get('content-type')?.includes('application/json')) {
            try {
                const originalBody = await c.res.clone().json();

                c.res = c.json({
                    ...originalBody,
                    _debug: {
                        executionTimeMs: ms.toFixed(2),
                        ...debugData
                    }
                }, c.res.status as any);
            } catch (e) {
                console.error('[DEBUG] Failed to inject debug data', e);
            }
        }
    }
});