# Mindplex Core API — Architecture

> This document explains the design philosophy behind the API. Read this before writing any new controller, service, or route.

---

## The Philosophy: "Opinionated Defaults + Sparse Fieldsets"

We need to support a high-performance frontend without falling into N+1 requests or the operational overhead of GraphQL. The Mindplex API follows a **hybrid REST architecture**: single, powerful resource controllers where the frontend dictates exactly how heavy the response should be using standardized query parameters.

---

## The 2 Golden Rules

1. **Field Selection is Granular:** The client can pick exactly which top-level fields they want to reduce payload size.
2. **Includes are "Opinionated":** If a client requests a nested relation (like an Author or Categories), the backend strictly defines the shape of that relation. The client cannot pick nested fields. This keeps URLs readable and the database secure.

---

## The Query Interface

Every standard `GET` endpoint accepts the following query parameters.

### `?fields=` (The Pruner)

Reduces the base resource to only the specified columns. If omitted, returns all standard columns.

- **Format:** Comma-separated strings.
- **Example:** `GET /api/v1/posts?fields=id,title,slug,featuredImageUrl`

### `?include=` (The Expander)

Attaches relational data ("Opinionated Packets") to the base resource.

- **Format:** Comma-separated strings. Validated against a strict allowlist per resource.
- **Example:** `GET /api/v1/posts?include=author,categories,tags`

### Filters & Pagination

Standard REST filtering using query params.

- **Example:** `GET /api/v1/posts?type=news&status=published&limit=10&offset=0`

---

## Opinionated Packets

When the frontend passes an `include` flag, the backend guarantees a specific, immutable data shape. The client gets no control over the fields inside these packets — that is intentional.

### Post Includes

| Include Flag    | What It Does                                                                                  | Resulting Shape                                         |
| --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `author`        | Joins `users` + `userProfiles`. Calculates `isFollowing` if viewer is authenticated.          | `{ id, username, displayName, avatarUrl, isFollowing }` |
| `categories`    | Joins through `postTaxonomies` where `type = 'category'`                                      | `[{ id, name, slug }]`                                  |
| `tags`          | Joins through `postTaxonomies` where `type = 'tag'`                                           | `[{ id, name, slug }]`                                  |
| `reputation`    | Joins reputation data for the author. Requires `author` to also be included.                  | `{ mpxr: number, level: number }`                       |
| `viewerContext` | Evaluates SQL `EXISTS` against `postReactions`, `bookmarks`, etc. for the authenticated user. | `{ isLiked: boolean, isBookmarked: boolean }`           |

### How to Add a New Opinionated Packet

1. Define the shape as a TypeScript type in the service layer.
2. Add the include key to the resource's allowlist (validated by the controller).
3. Implement the join/subquery in the service's query builder.
4. Document the shape in this file and in the route's OpenAPI schema.

---

## Sub-Resource Pattern

Interactions between a user and a resource are modeled as **sub-resources** of that resource, not as RPC-style action endpoints.

```
# Correct — sub-resource
POST /api/v1/posts/:slug/reactions       { "reaction": "like" }
DELETE /api/v1/posts/:slug/reactions

# Wrong — RPC-style
POST /api/v1/like_post                   { "slug": "...", "reaction": "like" }
POST /api/v1/posts/:slug/like
```

When a schema table has a unique constraint on `(userId, resourceId)`, the DELETE endpoint does not need an ID — the authenticated user + the parent slug is the unique key.

---

## Mutation Conventions

### Request Format

All request bodies must be `application/json`. No form-data unless handling explicit file uploads (e.g., media uploads). Every payload is validated against a Valibot schema before reaching the controller.

### Response Conventions

| Action                  | Response                                |
| ----------------------- | --------------------------------------- |
| Create                  | `201 Created` with the created resource |
| Update                  | `200 OK` with the updated resource      |
| Delete                  | `204 No Content`                        |
| Fire-and-forget (views) | `202 Accepted`                          |

Mutations can optionally accept `?include=` query parameters if the frontend needs the fully hydrated object back immediately after updating.

---

## Routing Structure

```
src/routes/
├── auth/                    # /auth/* — no version prefix
├── api/v1/
│   ├── posts/               # /api/v1/posts
│   │   ├── index.ts         # CRUD routes
│   │   ├── reactions.ts     # /api/v1/posts/:slug/reactions
│   │   ├── bookmarks.ts     # /api/v1/posts/:slug/bookmarks
│   │   ├── comments.ts      # /api/v1/posts/:slug/comments
│   │   └── ...
│   ├── users/               # /api/v1/users
│   │   ├── index.ts         # CRUD + /me routes
│   │   ├── follows.ts       # /api/v1/users/:username/follow
│   │   └── ...
│   ├── comments/            # /api/v1/comments (lifted from post context)
│   ├── taxonomies/          # /api/v1/taxonomies
│   ├── polls/               # /api/v1/polls
│   ├── notifications/       # /api/v1/notifications
│   ├── faqs/                # /api/v1/faqs
│   ├── media/               # /api/v1/media
│   └── admin/               # /api/v1/admin/*
└── legacy/                  # Adapters for backwards compatibility
```

### Controller → Service → Schema

Each route follows a strict separation:

- **Controller (route file):** Validates input (Valibot), extracts params, calls service, returns response.
- **Service:** Contains all Drizzle query logic and business rules. Never touches `c.req` or `c.json`.
- **Schema:** Drizzle table definitions and Valibot validation schemas.

Controllers should be thin. If a controller has more than ~15 lines of logic, it probably belongs in the service.

---

## Authentication & Authorization

### Middleware

- `requireAuth` — Verifies JWT and sets `c.get('user')`. Returns `401` if missing/invalid.
- `requireRole(role)` — Checks `user.role` against the role hierarchy. Returns `403` if insufficient.

### Role Hierarchy

```
Public < User < Collaborator < Editor < Moderator < Admin
```

Each role inherits all permissions from lower roles. The hierarchy is defined in `schema/types.ts` as `ROLE_HIERARCHY`.

### Endpoint Auth Markers

In the [API_SPEC.md](./API_SPEC.md):

| Marker   | Meaning                                    |
| -------- | ------------------------------------------ |
| required | Requires authentication                    |
| optional | Behaves differently for auth vs. anonymous |
| (none)   | Fully public                               |
