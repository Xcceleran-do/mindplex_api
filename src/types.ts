import * as schema from "$src/db/schema";
import { UserJwtPayload } from "$src/lib/jwt";
import type { DbClient } from "$src/db/client";
import type { Access } from "$src/db/schema";

export type AppContext = {
    Variables: {
        db: DbClient
        schema: typeof schema
        user: UserJwtPayload;
        debugData: Record<string, any>;
    };
};


type ExtractQueryConfig<T> = T extends { findMany: (config?: infer C) => any } ? C : never;
type ExtractWith<C> = C extends { with?: infer W } ? NonNullable<W> : never;

export type TableWithConfig<TableName extends keyof DbClient['query']> = ExtractWith<ExtractQueryConfig<DbClient['query'][TableName]>>;

export type IncludeConfig<TableName extends keyof DbClient['query']> = {
    drizzleWith: TableWithConfig<TableName>;
    requiredRole?: Access;
};
