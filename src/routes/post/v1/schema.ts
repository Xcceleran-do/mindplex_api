import * as v from 'valibot';
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from '$src/utils';
import { PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators';
import { posts } from '$src/db/schema';
import { getColumns } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';

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

export const PostDetailsSchema = v.object({
    fields: createFieldsSchema(posts, FORBIDDEN_COLUMNS),
    include: createIncludesSchema(ALLOWED_INCLUDES)
});

export const PostIdParamSchema = v.object({
    id: v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
});


const AuthorSchema = v.object({
    id: v.number(),
    username: v.string(),
});

const CategorySchema = v.object({
    id: v.number(),
    name: v.string(),
    type: v.string(),
    slug: v.string(),
});

export const PostRecordSchema = v.object({
    id: v.number(),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    author: v.optional(AuthorSchema),
    taxonomies: v.optional(v.array(CategorySchema)),
});

export const PostListResponseSchema = v.object({
    data: v.array(PostRecordSchema)
});


export const UpdateArticleSchema = v.object({
    title: v.optional(v.string()),
    teaser: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.string()),
});


/**
 * OpenAPI route documentation
 */
export const postListDocs = describeRoute({
    tags: ['Posts'],
    summary: 'List Posts',
    description: `Fetches posts. Available includes: 'authors' (Admin only), 'categories'. 
    Allowed fields: ${getAllowedFields(posts, FORBIDDEN_COLUMNS).join(', ')}`,
    responses: {
        200: {
            description: 'Successful Response',
            content: {
                'application/json': {
                    schema: resolver(PostListResponseSchema)
                }
            }
        }
    }
});


export const postDetailsDocs = describeRoute({
    tags: ['Posts'],
    summary: 'Post Details',
    description: `Fetches post details. Available includes: 'authors', 'categories'. 
    Allowed fields: ${getAllowedFields(posts, FORBIDDEN_COLUMNS).join(', ')}`,
    responses: {
        200: {
            description: 'Successful Response',
            content: {
                'application/json': {
                    schema: resolver(PostRecordSchema)
                }
            }
        }
    }
});