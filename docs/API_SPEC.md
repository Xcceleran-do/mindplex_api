# Mindplex Core API — Endpoint Specification

> This document is the single source of truth for every REST endpoint in the Mindplex API.
> Every table in the database schema maps to endpoints listed here. If it's not in this doc, it doesn't exist yet.

---

## Conventions

Before diving into endpoints, understand these patterns — they apply everywhere.

### URL Structure

```
/auth/*                        → Authentication (no version prefix)
/api/v1/{resource}             → Top-level resources
/api/v1/{resource}/:id         → Single resource by ID
/api/v1/{resource}/:slug       → Single resource by slug (posts, taxonomies)
/api/v1/{parent}/:id/{child}   → Sub-resources (interactions, nested entities)
/api/v1/users/me/*             → Authenticated user's own data
/api/v1/users/:username/*      → Public-facing user data
/api/v1/admin/*                → Admin-only operations
```

### HTTP Methods

| Method | Purpose | Typical Response |
|--------|---------|-----------------|
| `GET` | Read | `200` with data |
| `POST` | Create | `201` with created resource |
| `PATCH` | Partial update | `200` with updated resource |
| `DELETE` | Remove | `204` no content |

### Query Parameters (GET requests)

All list endpoints accept:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `fields` | Comma-separated column names to return | `?fields=id,title,slug` |
| `include` | Comma-separated relations to expand | `?include=author,categories` |
| `limit` | Page size (default varies by resource) | `?limit=10` |
| `offset` | Pagination offset | `?offset=20` |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full data fetching philosophy behind `fields` and `include`.

### DELETE Without ID

When a schema has a unique constraint on `(userId, resourceId)` — such as reactions, bookmarks, and peoples_choice_votes — the authenticated user + the parent resource slug is already a unique identifier. No need for `/:id` in the URL.

### Authentication

Endpoints that require auth are marked with required. Endpoints that behave differently for authenticated vs. anonymous users are marked with open. Public endpoints have no marker.

---

## Auth

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Create account | `{ "username", "email", "password" }` |
| `POST` | `/auth/login` | Email/password login | `{ "email", "password" }` |
| `POST` | `/auth/social` | Social OAuth login | `{ "provider": "google", "token": "..." }` |
| `POST` | `/auth/refresh` | Rotate refresh token | `{ "refreshToken": "..." }` |
| `POST` | `/auth/logout` | Revoke refresh token | `{ "refreshToken": "..." }` |
| `POST` | `/auth/activate` | Verify activation token | `{ "token": "..." }` |
| `POST` | `/auth/resend-activation` | Resend activation email | `{ "email": "..." }` |
| `POST` | `/auth/forgot-password` | Request password reset | `{ "email": "..." }` |
| `POST` | `/auth/reset-password` | Set new password | `{ "token", "password" }` |

**Schema tables:** `users`, `refreshTokens`, `activationTokens`, `userSocialAuths`

---

## Users

### Account & Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/users` | | List users (public directory) |
| `GET` | `/api/v1/users/:username` | | Public profile |
| `GET` | `/api/v1/users/me` | required | Authenticated user's own data |
| `PATCH` | `/api/v1/users/me` | required | Update account (email, username) |
| `DELETE` | `/api/v1/users/me` | required | Delete account |

### Profile Details

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/profile` | required | Get profile | |
| `PATCH` | `/api/v1/users/me/profile` | required | Update profile | `{ "firstName", "bio", "socialMedia": {} }` |

### Preferences

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/preferences` | required | Get preferences | |
| `PATCH` | `/api/v1/users/me/preferences` | required | Update preferences | `{ "theme": "dark", "privacyAge": "public" }` |

### Notification Settings

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/notification-settings` | required | Get settings | |
| `PATCH` | `/api/v1/users/me/notification-settings` | required | Update settings | `{ "notifyFollower": false }` |

### Social Auth Links

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/users/me/social-auths` | required | List linked providers |
| `DELETE` | `/api/v1/users/me/social-auths/:provider` | required | Unlink a provider |

**Schema tables:** `users`, `userProfiles`, `userPreferences`, `userNotificationSettings`, `userSocialAuths`

---

## User Profiles (Interests & Education)

### Interests

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/interests` | required | List interests | |
| `POST` | `/api/v1/users/me/interests` | required | Add interest | `{ "interest": "AI", "isPrimary": true }` |
| `PATCH` | `/api/v1/users/me/interests/:id` | required | Update | |
| `DELETE` | `/api/v1/users/me/interests/:id` | required | Remove | |

### Education

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/education` | required | List education | |
| `POST` | `/api/v1/users/me/education` | required | Add | `{ "educationalBackground": "MSc Computer Science" }` |
| `PATCH` | `/api/v1/users/me/education/:id` | required | Update | |
| `DELETE` | `/api/v1/users/me/education/:id` | required | Remove | |

**Schema tables:** `userInterests`, `userEducation`

---

## Wallets

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/wallets` | required | List wallets | |
| `POST` | `/api/v1/users/me/wallets` | required | Connect wallet | `{ "publicAddress": "0x..." }` |
| `PATCH` | `/api/v1/users/me/wallets/:id` | required | Update (set payment address) | |
| `DELETE` | `/api/v1/users/me/wallets/:id` | required | Disconnect | |
| `POST` | `/api/v1/users/me/wallets/:id/verify` | required | Verify ownership | |
| `POST` | `/api/v1/users/me/wallets/:id/verify-payment` | required | Verify payment address | |

**Schema tables:** `userWallets`

---

## Social

### Follows

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/users/:username/followers` | | List followers |
| `GET` | `/api/v1/users/:username/following` | | List following |
| `POST` | `/api/v1/users/:username/follow` | required | Follow user |
| `DELETE` | `/api/v1/users/:username/follow` | required | Unfollow user |
| `POST` | `/api/v1/users/:username/block` | required | Block user |
| `DELETE` | `/api/v1/users/:username/block` | required | Unblock user |

### Friend Requests

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/friend-requests` | required | List received requests | |
| `GET` | `/api/v1/users/me/friend-requests/sent` | required | List sent requests | |
| `POST` | `/api/v1/users/:username/friend-requests` | required | Send request | |
| `PATCH` | `/api/v1/users/me/friend-requests/:id` | required | Respond | `{ "status": "accepted" }` |
| `DELETE` | `/api/v1/users/me/friend-requests/:id` | required | Cancel sent request | |

**Schema tables:** `follows`, `friendRequests`

---

## Posts

### Core CRUD

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/posts` | | List posts `?type=news&status=published&fields=id,title&include=author,categories` |
| `GET` | `/api/v1/posts/:slug` | 🔓 | Single post `?include=author,reputation,categories,tags,viewerContext` |
| `POST` | `/api/v1/posts` | required | Create post |
| `PATCH` | `/api/v1/posts/:slug` | required | Update post |
| `DELETE` | `/api/v1/posts/:slug` | required | Trash post |

### Co-Authors

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/posts/:slug/authors` | | List co-authors | |
| `POST` | `/api/v1/posts/:slug/authors` | required | Add co-author | `{ "userId": 5, "role": "editor" }` |
| `PATCH` | `/api/v1/posts/:slug/authors/:userId` | required | Update role/order | |
| `DELETE` | `/api/v1/posts/:slug/authors/:userId` | required | Remove co-author | |

### Media

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/media` | required | Upload file (multipart) |
| `GET` | `/api/v1/media` | required | List uploads |
| `GET` | `/api/v1/media/:id` | required | Single media |
| `PATCH` | `/api/v1/media/:id` | required | Update alt text/caption |
| `DELETE` | `/api/v1/media/:id` | required | Delete media |

**Schema tables:** `posts`, `postAuthors`, `media`

---

## Post Interactions

All interaction endpoints use the post slug as the identifier. DELETE endpoints don't require an ID because the schema enforces a unique constraint per user+post.

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/posts/:slug/views` | 🔓 | Track a view (returns `202`) | |
| `POST` | `/api/v1/posts/:slug/reactions` | required | Like/dislike | `{ "reaction": "like" }` |
| `DELETE` | `/api/v1/posts/:slug/reactions` | required | Remove reaction | |
| `POST` | `/api/v1/posts/:slug/emojis` | required | Add emoji | `{ "emojiValue": "🔥", "sentiment": "positive" }` |
| `DELETE` | `/api/v1/posts/:slug/emojis/:emojiValue` | required | Remove emoji | |
| `POST` | `/api/v1/posts/:slug/bookmarks` | required | Bookmark | |
| `DELETE` | `/api/v1/posts/:slug/bookmarks` | required | Unbookmark | |
| `POST` | `/api/v1/posts/:slug/shares` | required | Record share | `{ "platform": "twitter" }` |
| `POST` | `/api/v1/posts/:slug/peoples-choice` | required | Cast vote | |
| `DELETE` | `/api/v1/posts/:slug/peoples-choice` | required | Remove vote | |

**View tracking note:** The `views` endpoint returns `202 Accepted` to signal fire-and-forget processing. For authenticated users, a row is inserted into `interactions`. For unauthenticated users, only `posts.viewCount` is incremented (Redis INCR + periodic flush when Redis is available).

**Schema tables:** `postReactions`, `postEmojis`, `bookmarks`, `shares`, `peoplesChoiceVotes`, `interactions`

---

## Taxonomies

### Taxonomy CRUD

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/taxonomies` | | List `?type=category` | |
| `GET` | `/api/v1/taxonomies/:slug` | | Single (with children) | |
| `POST` | `/api/v1/taxonomies` | required | Create | `{ "name": "AI", "type": "category", "parentId": null }` |
| `PATCH` | `/api/v1/taxonomies/:slug` | required | Update | |
| `DELETE` | `/api/v1/taxonomies/:slug` | required | Delete | |

### Post ↔ Taxonomy Associations

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/posts/:slug/taxonomies` | | List post's categories/tags | |
| `POST` | `/api/v1/posts/:slug/taxonomies` | required | Attach | `{ "taxonomyId": 3, "isPrimary": true }` |
| `DELETE` | `/api/v1/posts/:slug/taxonomies/:taxonomyId` | required | Detach | |

**Schema tables:** `taxonomies`, `postTaxonomies`

---

## Comments

### Comment CRUD

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/posts/:slug/comments` | | List comments `?status=approved` | |
| `POST` | `/api/v1/posts/:slug/comments` | 🔓 | Create comment | `{ "content": "...", "parentId": null }` |
| `PATCH` | `/api/v1/comments/:id` | required | Edit comment | `{ "content": "..." }` |
| `DELETE` | `/api/v1/comments/:id` | required | Delete comment | |

Note: Comments lift out of the post context once created — editing and deleting use `/api/v1/comments/:id` directly.

Guest comments (when `commentEnabled` is true on the post) can include `guestAuthorName` and `guestAuthorEmail` instead of requiring auth.

### Comment Reactions

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/comments/:id/reactions` | required | Like/dislike | `{ "reaction": "like" }` |
| `DELETE` | `/api/v1/comments/:id/reactions` | required | Remove reaction | |

### Comment Classifications

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/comments/:id/classifications` | required | Classify (mod action) | `{ "classification": "best", "sentiment": "positive" }` |
| `GET` | `/api/v1/comments/:id/classifications` | required | List classifications | |

**Schema tables:** `comments`, `commentReactions`, `commentClassifications`

---

## Polls

### Poll CRUD

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/polls` | | List active polls | |
| `GET` | `/api/v1/posts/:slug/poll` | | Get poll attached to a post (singular — 1:1 relationship) | |
| `POST` | `/api/v1/polls` | required | Create poll | `{ "postId": 101, "title", "question", "options": [...] }` |
| `PATCH` | `/api/v1/polls/:id` | required | Update poll | |
| `DELETE` | `/api/v1/polls/:id` | required | Delete poll | |

### Poll Options

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/polls/:id/options` | required | Add option |
| `PATCH` | `/api/v1/polls/:id/options/:optionId` | required | Update option |
| `DELETE` | `/api/v1/polls/:id/options/:optionId` | required | Remove option |

### Poll Voting

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/polls/:id/votes` | 🔓 | Cast vote | `{ "optionId": 12 }` |
| `DELETE` | `/api/v1/polls/:id/votes` | 🔓 | Remove vote | |
| `GET` | `/api/v1/polls/:id/results` | | Aggregated results | |

### Poll Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/poll-categories` | | List categories |
| `POST` | `/api/v1/poll-categories` | required | Create category |
| `PATCH` | `/api/v1/poll-categories/:id` | required | Update category |
| `DELETE` | `/api/v1/poll-categories/:id` | required | Delete category |

**Schema tables:** `polls`, `pollOptions`, `pollVotes`, `pollCategories`

---

## Notifications

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/notifications` | required | List notifications `?status=unread` | |
| `GET` | `/api/v1/notifications/count` | required | Unread count (lightweight) | |
| `PATCH` | `/api/v1/notifications/:id` | required | Mark read | `{ "status": "read" }` |
| `PATCH` | `/api/v1/notifications/read-all` | required | Mark all read | |
| `DELETE` | `/api/v1/notifications/:id` | required | Dismiss | |

**Schema tables:** `notifications`

---

## Reading Sessions & Interactions

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/posts/:slug/reading-sessions` | required | Log reading session | `{ "status": "completed", "userSpentTimeSec": 120, "completionRatio": 0.85 }` |
| `GET` | `/api/v1/users/me/reading-history` | required | List reading sessions `?status=completed` | |
| `GET` | `/api/v1/users/me/interactions` | required | Activity log `?module=post&type=view` | |

**Schema tables:** `readingSessions`, `interactions`

---

## FAQs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/faqs` | | List all categories with questions |
| `GET` | `/api/v1/faqs/:slug` | | Single category with questions |

### FAQ Admin

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/faqs/categories` | required | Create category | `{ "name", "slug", "parentId" }` |
| `PATCH` | `/api/v1/faqs/categories/:id` | required | Update category | |
| `DELETE` | `/api/v1/faqs/categories/:id` | required | Delete category | |
| `POST` | `/api/v1/faqs/categories/:id/questions` | required | Add question | `{ "question", "answer" }` |
| `PATCH` | `/api/v1/faqs/questions/:id` | required | Update question | |
| `DELETE` | `/api/v1/faqs/questions/:id` | required | Delete question | |

**Schema tables:** `faqCategories`, `faqQuestions`

---

## Content Sources / Feeds

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `GET` | `/api/v1/users/me/feeds` | required | List user's content sources | |
| `POST` | `/api/v1/users/me/feeds` | required | Add source | `{ "name": "TechCrunch", "url": "...", "type": "rss" }` |
| `PATCH` | `/api/v1/users/me/feeds/:id` | required | Update source | |
| `DELETE` | `/api/v1/users/me/feeds/:id` | required | Remove source | |
| `POST` | `/api/v1/feeds/:sourceItemId/reactions` | required | React to feed item | `{ "reaction": "like", "emojiValue": "👍", "emojiSentiment": "positive" }` |
| `DELETE` | `/api/v1/feeds/:sourceItemId/reactions` | required | Remove reaction | |

**Schema tables:** `contentSources`, `contentSourceReactions`

---

## Mailings

### Public

| Method | Endpoint | Auth | Description | Body |
|--------|----------|------|-------------|------|
| `POST` | `/api/v1/subscribe` | | Subscribe to mailing list | `{ "email": "...", "listType": "newsletter" }` |
| `DELETE` | `/api/v1/subscribe` | | Unsubscribe | `{ "email": "..." }` |
| `POST` | `/api/v1/contact` | | Submit contact form | `{ "firstName", "lastName", "email", "message" }` |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/admin/campaigns` | required | List campaigns |
| `POST` | `/api/v1/admin/campaigns` | required | Create campaign |
| `GET` | `/api/v1/admin/campaigns/:id` | required | Single campaign with deliveries |
| `GET` | `/api/v1/admin/campaigns/:id/deliveries` | required | Delivery status list |

**Schema tables:** `mailingListSubscribers`, `contactSubmissions`, `emailCampaigns`, `emailDeliveries`

---

## Schema Coverage Checklist

Every schema table is accounted for:

| Schema Table | Endpoints Section |
|---|---|
| `users` | Auth, Users |
| `userProfiles` | Users > Profile Details |
| `userPreferences` | Users > Preferences |
| `userNotificationSettings` | Users > Notification Settings |
| `userSocialAuths` | Users > Social Auth Links |
| `refreshTokens` | Auth (internal) |
| `activationTokens` | Auth (internal) |
| `userInterests` | User Profiles > Interests |
| `userEducation` | User Profiles > Education |
| `userWallets` | Wallets |
| `follows` | Social > Follows |
| `friendRequests` | Social > Friend Requests |
| `posts` | Posts |
| `postAuthors` | Posts > Co-Authors |
| `media` | Posts > Media |
| `postReactions` | Post Interactions |
| `postEmojis` | Post Interactions |
| `bookmarks` | Post Interactions |
| `shares` | Post Interactions |
| `peoplesChoiceVotes` | Post Interactions |
| `taxonomies` | Taxonomies |
| `postTaxonomies` | Taxonomies > Post Associations |
| `comments` | Comments |
| `commentReactions` | Comments > Reactions |
| `commentClassifications` | Comments > Classifications |
| `polls` | Polls |
| `pollOptions` | Polls > Options |
| `pollVotes` | Polls > Voting |
| `pollCategories` | Polls > Categories |
| `notifications` | Notifications |
| `readingSessions` | Reading Sessions |
| `interactions` | Reading Sessions & Interactions |
| `faqCategories` | FAQs |
| `faqQuestions` | FAQs |
| `contentSources` | Content Sources / Feeds |
| `contentSourceReactions` | Content Sources / Feeds |
| `mailingListSubscribers` | Mailings |
| `contactSubmissions` | Mailings |
| `emailCampaigns` | Mailings > Admin |
| `emailDeliveries` | Mailings > Admin |
