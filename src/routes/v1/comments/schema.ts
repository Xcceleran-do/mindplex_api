import * as v from 'valibot';
import { createFieldsSchema, createIncludesSchema, getAllowedFields } from '$src/utils';
import { IdParamSchema, PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators';
import { comments } from '$src/db/schema';
import { describeRoute, resolver } from 'hono-openapi';
import { CommentRecordSchema, CommentListResponseSchema, FORBIDDEN_COLUMNS, ALLOWED_INCLUDES } from '$src/routes/v1/posts/comments/schema';


// ─── Params ─────────────────────────────────────────────────

export const CommentIdParamSchema = v.object({
    id: IdParamSchema,
});


// ─── Query Schemas ──────────────────────────────────────────

export const ReplyListQuerySchema = v.object({
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(comments, FORBIDDEN_COLUMNS),
    include: createIncludesSchema(ALLOWED_INCLUDES),
    status: v.optional(v.picklist(['approved', 'pending', 'spam', 'trashed']), 'approved'),
});


// ─── Body Schemas ───────────────────────────────────────────

export const UpdateCommentSchema = v.object({
    content: v.pipe(v.string(), v.minLength(1), v.maxLength(10000)),
});


// ─── OpenAPI Docs ───────────────────────────────────────────

const fieldsList = getAllowedFields(comments, FORBIDDEN_COLUMNS).join(', ');

export const listRepliesDocs = describeRoute({
    tags: ['Comments'],
    summary: 'List Replies to Comment',
    description: `Paginated replies for a comment. Defaults to ?status=approved.\n\nIncludes: ${ALLOWED_INCLUDES.join(', ')}. Fields: ${fieldsList}`,
    responses: {
        200: { description: 'OK', content: { 'application/json': { schema: resolver(CommentListResponseSchema) } } },
        404: { description: 'Comment not found' },
    },
});

export const updateCommentDocs = describeRoute({
    tags: ['Comments'],
    summary: 'Edit Comment',
    security: [{ bearerAuth: [] }],
    responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: resolver(CommentRecordSchema) } } },
        403: { description: 'Forbidden' },
        404: { description: 'Comment not found' },
    },
});

export const deleteCommentDocs = describeRoute({
    tags: ['Comments'],
    summary: 'Delete Comment',
    security: [{ bearerAuth: [] }],
    responses: {
        204: { description: 'Deleted' },
        403: { description: 'Forbidden' },
        404: { description: 'Comment not found' },
    },
});