import {
    pgTable,
    serial,
    varchar,
    timestamp,
    integer,
    unique,
    index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";
import { comments } from "./comments";
import type {
    FollowStatus,
    FriendRequestStatus,
    ReactionType,
    EmojiSentiment,
} from "./types";


export const follows = pgTable("follows", {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 })
        .$type<FollowStatus>()
        .default("follow")
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("follows_pair_idx").on(table.followerId, table.followingId),
        index("follows_follower_id_idx").on(table.followerId),
        index("follows_following_id_idx").on(table.followingId),
    ]
);

export const friendRequests = pgTable("friend_requests", {
    id: serial("id").primaryKey(),
    requesterId: integer("requester_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    requestedId: integer("requested_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 })
        .$type<FriendRequestStatus>()
        .default("pending")
        .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("friend_requests_pair_idx").on(
            table.requesterId,
            table.requestedId
        ),
        index("friend_requests_requested_id_idx").on(table.requestedId),
        index("friend_requests_status_idx").on(table.status),
    ]
);

export const postReactions = pgTable("post_reactions", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 10 })
        .$type<ReactionType>()
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("post_reactions_user_post_idx").on(table.postId, table.userId),
        index("post_reactions_post_id_idx").on(table.postId),
        index("post_reactions_user_id_idx").on(table.userId),
    ]
);


export const commentReactions = pgTable("comment_reactions", {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
        .notNull()
        .references(() => comments.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 10 })
        .$type<ReactionType>()
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("comment_reactions_user_comment_idx").on(
            table.commentId,
            table.userId
        ),
        index("comment_reactions_comment_id_idx").on(table.commentId),
    ]
);

export const postEmojis = pgTable("post_emojis", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    emojiValue: varchar("emoji_value", { length: 20 }).notNull(),
    sentiment: varchar("sentiment", { length: 10 })
        .$type<EmojiSentiment>()
        .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("post_emojis_user_post_emoji_idx").on(
            table.postId,
            table.userId,
            table.emojiValue
        ),
        index("post_emojis_post_id_idx").on(table.postId),
    ]
);

export const bookmarks = pgTable("bookmarks", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("bookmarks_user_post_idx").on(table.userId, table.postId),
        index("bookmarks_user_id_idx").on(table.userId),
    ]
);

export const shares = pgTable("shares", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }),
    externalShareId: varchar("external_share_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        index("shares_post_id_idx").on(table.postId),
        index("shares_user_id_idx").on(table.userId),
    ]
);

export const peoplesChoiceVotes = pgTable("peoples_choice_votes", {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
        .notNull()
        .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
},
    (table) => [
        unique("peoples_choice_user_post_idx").on(table.userId, table.postId),
    ]
);
