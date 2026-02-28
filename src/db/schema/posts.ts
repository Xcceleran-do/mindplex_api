import {
    pgTable,
    serial,
    varchar,
    text,
    jsonb,
    boolean,
    timestamp,
    integer,
    unique,
    index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import type { PostStatus, PostType } from "./types";

export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt").default(""),
    featuredImageUrl: text("featured_image_url"),

    status: varchar("status", { length: 20 })
        .$type<PostStatus>()
        .default("draft")
        .notNull(),
    type: varchar("type", { length: 20 })
        .$type<PostType>()
        .default("article")
        .notNull(),
    commentEnabled: boolean("comment_enabled").default(true).notNull(),
    originResource: varchar("origin_resource", { length: 50 }),

    estimatedReadingMinutes: integer("estimated_reading_minutes"),
    viewCount: integer("view_count").default(0).notNull(),


    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull()
        .$onUpdate(() => new Date()),
},
    (table) => [
        index("posts_author_id_idx").on(table.authorId),
        index("posts_status_idx").on(table.status),
        index("posts_type_idx").on(table.type),
        index("posts_slug_idx").on(table.slug),
        index("posts_published_at_idx").on(table.publishedAt),
        index("posts_status_type_published_idx").on(
            table.status,
            table.type,
            table.publishedAt
        ),
    ]
);

export const postAuthors = pgTable("post_authors", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 100 }).default("author"),
    position: varchar("position", { length: 255 }),
    department: varchar("department", { length: 255 }),
    displayOrder: integer("display_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("post_authors_post_user_idx").on(table.postId, table.userId),
        index("post_authors_user_id_idx").on(table.userId),
    ]
);

// ============================================================================
// Media (replaces WP attachment post type)
// ============================================================================

export const media = pgTable(
    "media",
    {
        id: serial("id").primaryKey(),
        uploaderId: integer("uploader_id").references(() => users.id, {
            onDelete: "set null",
        }),
        url: text("url").notNull(),
        altText: text("alt_text"),
        caption: text("caption"),
        mimeType: varchar("mime_type", { length: 100 }).notNull(),
        sizeBytes: integer("size_bytes"),
        width: integer("width"),
        height: integer("height"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("media_uploader_id_idx").on(table.uploaderId)]
);
