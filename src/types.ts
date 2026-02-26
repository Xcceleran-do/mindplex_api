import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema";
import { UserJwtPayload } from "$src/lib/jwt";

export type AppContext = {
    Variables: {
        db: NodePgDatabase<typeof schema>
        schema: typeof schema
        user: UserJwtPayload;
    };
};
