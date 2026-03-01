import * as v from 'valibot';
import { createFieldsSchema, createIncludesSchema } from '$src/utils';
import { PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators';
import { posts } from '$src/db/schema';
import { getColumns } from 'drizzle-orm';


const postsCol = getColumns(posts)

type PostColumn = keyof typeof postsCol;

export const FORBIDDEN_COLUMNS = new Set<PostColumn>(['commentEnabled'])
export const ALLOWED_INCLUDES = ['authors', 'categories', 'tags', 'reputation']


export const PostSchema = v.object({
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(posts, FORBIDDEN_COLUMNS),
    include: createIncludesSchema(ALLOWED_INCLUDES)
});
