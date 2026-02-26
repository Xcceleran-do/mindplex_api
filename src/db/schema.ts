import { relations } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  text,
  date,
  jsonb,
  boolean,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";

type SessionMetadata = {
  ip?: string;
  userAgent?: string;
  deviceType?: string;
  location?: string;
};
export type Role = 'user' | 'admin' | 'moderator' | "collaborator"
type PrivacyLevel = "Public" | "Private" | "FollowersOnly";
type Theme = "light" | "dark" | "system";
type Provider = "google" | "apple" | "facebook";
type SocialMedia = {
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 60 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 20 }).$type<Role>().default('user').notNull(),
  isActivated: boolean("is_activated").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userProfiles = pgTable("user_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender", { length: 50 }),
  education: varchar("education", { length: 255 }),

  socialMedia: jsonb("social_media")
    .$type<SocialMedia>()
    .default({}),
});

export const userPreferences = pgTable("user_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: varchar("theme", { length: 20 }).$type<Theme>().default("light"),
  privacyAge: varchar("privacy_age", { length: 20 })
    .$type<PrivacyLevel>()
    .default("Private"),
  privacyGender: varchar("privacy_gender", { length: 20 })
    .$type<PrivacyLevel>()
    .default("Private"),
  privacyEducation: varchar("privacy_education", { length: 20 })
    .$type<PrivacyLevel>()
    .default("Private"),
});

export const userNotificationSettings = pgTable("user_notification_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyPublications: boolean("notify_publications").default(true),
  notifyFollower: boolean("notify_follower").default(true),
  notifyInteraction: boolean("notify_interaction").default(true),
  notifyWeekly: boolean("notify_weekly").default(true),
  notifyUpdates: boolean("notify_updates").default(true),
});

export const userSocialAuths = pgTable(
  "user_social_auths",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).$type<Provider>().notNull(),
    providerId: varchar("provider_id", { length: 255 }).unique().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_social_auths_user_provider_idx").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).unique().notNull(),

  familyId: varchar('family_id', { length: 255 }).notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),

  metadata: jsonb('metadata').$type<SessionMetadata>().default({}),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  familyExpiresAt: timestamp('family_expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const activationTokens = pgTable('activation_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
  notificationSettings: one(userNotificationSettings, {
    fields: [users.id],
    references: [userNotificationSettings.userId],
  }),
  socialAuths: many(userSocialAuths),
  refreshTokens: many(refreshTokens),
  activationTokens: many(activationTokens),
}));
