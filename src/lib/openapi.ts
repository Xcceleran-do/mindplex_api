import { openAPIRouteHandler } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import type { Hono } from 'hono';
import type { AppContext } from '$src/types';

export function registerDocs(app: Hono<AppContext>) {
    app.get('/openapi', openAPIRouteHandler(app, {
        documentation: {
            info: {
                title: 'Mindplex API',
                version: '0.1.0',
                description: 'API documentation',
            },
            servers: [
                { url: 'http://localhost:3000', description: 'Local' },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
        },
    }));

    app.get('/docs', Scalar({
        theme: 'kepler',
        spec: { url: '/openapi' },
    }));
}