import type { IncludeConfig } from "./types";


export const defineInclude = <
    const TShape extends string,
    const TKey extends string = string
>(
    config: IncludeConfig<TShape, TKey>
) => config;