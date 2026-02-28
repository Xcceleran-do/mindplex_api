import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { InferSelectModel } from "drizzle-orm";
import type { Role } from "./roles";

// ── Base ─────────────────────────────────────────────────────────────────────

type BaseConfig<TShape extends string, TKey extends string> = {
    shape: readonly TShape[];
    depends?: readonly TKey[];
};

// ── Join ─────────────────────────────────────────────────────────────────────
// TTable flows through so shape is validated against real column names

export type JoinConfig
  TTable extends PgTable,
  TShape extends keyof InferSelectModel<TTable> & string,
    TKey extends string,
> = BaseConfig<TShape, TKey> & {
    type: "join";
    table: TTable;
    on: SQL<unknown>;
    through?: {
        table: PgTable;
        on: SQL<unknown>;
    };
    requiredRole: Role | null;
};

// ── Public query ──────────────────────────────────────────────────────────────
// userId may be null — caller handles the guest case

export type PublicQueryConfig
  TShape extends string,
  TKey extends string,
> = BaseConfig<TShape, TKey> & {
    type: "public-query";
    requiredRole: null;
    query: (userId: number | null) => Record<TShape, SQL<unknown>>;
};

// ── Batch query ───────────────────────────────────────────────────────────────
// userId is guaranteed — requiredRole ensures auth before this runs
// returns a complete executable SQL statement (CTE + SELECT)

export type BatchQueryConfig
  TShape extends string,
  TKey extends string,
> = BaseConfig<TShape, TKey> & {
    type: "batch-query";
    requiredRole: Role;
    query: (userId: number, resourceIds: number[]) => SQL<unknown>;
};

// ── Union ─────────────────────────────────────────────────────────────────────

export type IncludeConfig<TShape extends string, TKey extends string> =
    | JoinConfig<PgTable, TShape & string, TKey>
    | PublicQueryConfig<TShape, TKey>
    | BatchQueryConfig<TShape, TKey>;

// ── IncludeMap ────────────────────────────────────────────────────────────────
// Used as the satisfies target in each resource's includes file
// Ensures every key in TKey union has an implementation

export type IncludeMap<TKey extends string> = Record
TKey,
    IncludeConfig < string, TKey >
>;

// ── Helpers ───────────────────────────────────────────────────────────────────
// Extract just the computed include keys from a map (public-query | batch-query)
// Useful in the route builder to split RQB includes from custom ones

export type ComputedIncludeKey<TMap extends Record<string, IncludeConfig<string, string>>> = {
    [K in keyof TMap]: TMap[K] extends JoinConfig<PgTable, string, string> ? never : K;
}[keyof TMap];

export type JoinIncludeKey<TMap extends Record<string, IncludeConfig<string, string>>> = {
    [K in keyof TMap]: TMap[K] extends JoinConfig<PgTable, string, string> ? K : never;
}[keyof TMap];