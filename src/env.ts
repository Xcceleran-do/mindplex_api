import * as v from 'valibot';

const EnvSchema = v.object({
    NODE_ENV: v.optional(v.picklist(['development', 'production', 'test']), 'development'),
    PORT: v.optional(v.pipe(v.string(), v.transform(Number), v.integer()), '3000'),

    DATABASE_URL: v.string('DATABASE_URL is required'),

    JWT_SECRET: v.pipe(
        v.string('JWT_SECRET is required'),
        v.minLength(32, 'JWT_SECRET must be at least 32 characters'),
    ),

    GOOGLE_CLIENT_ID: v.string('GOOGLE_CLIENT_ID is required'),
    DB_USE_SSL: v.optional(v.picklist(['true', 'false']), 'false'),
    WP_API_BASE_URL: v.pipe(v.string(), v.url()),
});

type Env = v.InferOutput<typeof EnvSchema>;

function loadEnv(): Env {
    const result = v.safeParse(EnvSchema, process.env);

    if (!result.success) {
        const issues = result.issues.map(i => `  - ${i.path?.[0]?.key}: ${i.message}`).join('\n');
        console.error(`\n Invalid environment variables:\n${issues}\n`);
        process.exit(1);
    }

    return result.output;
}

export const env = loadEnv();