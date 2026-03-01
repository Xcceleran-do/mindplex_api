
import { env } from '$env'
import { Pool } from 'pg';
import { drizzle } from "drizzle-orm/node-postgres";

import { relations } from '$src/db/schema/relations'
import * as schema from '$src/db/schema'

const ssl = env.DB_USE_SSL === 'true' ? {
    rejectUnauthorized: false,
} : false


const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: ssl
});


export const db = drizzle({ schema, client: pool, relations });
export type DbClient = typeof db;