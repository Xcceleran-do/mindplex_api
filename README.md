
# Mindplex Core API

Mindplex Core API is the backend service powering the Mindplex platform. It is a high-performance REST API built with Hono on Bun, utilizing PostgreSQL, Redis, and Drizzle ORM.

## Quick Start

Follow these steps to spin up the development environment.

### 1. Installation

```bash
# Clone the repository and install dependencies
bun install

# Copy the example environment file and fill in your local values
cp .env.example .env

```

### 2. Infrastructure Setup

Ensure Docker is running on your machine, then start the required database and cache containers.

```bash
# Start PostgreSQL and Redis
make infra

# Run Drizzle migrations to set up the database schema
make migrate

```

### 3. Run the Server

```bash
# Start the API locally using Bun
bun run dev

# Alternatively, run the entire stack (API + Infra) inside Docker
make dev

```

## Environment Variables

All environment variables are validated at startup using Valibot. Missing or invalid values will prevent the application from starting.

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | No | `development` |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Minimum 32 characters for signing access tokens |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |

## Project Structure

```text
src/
├── db/
│   └── schema/            # Domain-driven Drizzle ORM tables (users, posts, etc.)
│       ├── index.ts       # Aggregator for all schemas
│       └── types.ts       # Shared TypeScript literal types
├── lib/
│   ├── env.ts             # Typed environment validation
│   ├── tokens.ts          # Token generation, hashing, and verification
│   └── openapi.ts         # Scalar UI and OpenAPI registration
├── middleware/
│   └── auth.ts            # requireAuth and role-based access middleware
├── routes/
│   ├── api/v1/            # Modern REST controllers
│   ├── legacy/            # Adapters for backwards compatibility with WP clients
│   └── auth/              # Authentication routes
├── services/              # Drizzle query logic and business rules
├── types.ts               # Hono AppContext and global types
└── index.ts               # Application entrypoint

```

## API Architecture & Data Fetching Spec

### The Philosophy: "Opinionated Defaults + Sparse Fieldsets"

To support a high-performance modern frontend without falling into the trap of N+1 requests or the massive operational overhead of GraphQL, the Mindplex API follows a hybrid REST architecture.

We expose single, powerful Resource Controllers (e.g., `/api/v1/posts`). The frontend dictates exactly how heavy the response should be using standardized query parameters.

### The 2 Golden Rules

1. **Field Selection is Granular:** The client can pick exactly which top-level fields they want to reduce payload size.
2. **Includes are "Opinionated":** If a client requests a nested relation (like an Author or Categories), the backend strictly defines the shape of that relation. The client cannot pick nested fields. This keeps URLs readable and the database secure.

### The Query Interface

Every standard `GET` endpoint accepts the following query parameters:

#### 1. `?fields=` (The Pruner)

Reduces the base resource to only the specified columns. If omitted, returns all standard columns.

* **Format:** Comma-separated strings.
* **Example:** `GET /api/v1/posts?fields=id,title,slug,featuredImageUrl`

#### 2. `?include=` (The Expander)

Attaches relational data ("Opinionated Packets") to the base resource.

* **Format:** Comma-separated strings. Validated against a strict allowlist.
* **Example:** `GET /api/v1/posts?include=author,categories,tags`

#### 3. Filters & Pagination

Standard REST filtering.

* **Example:** `GET /api/v1/posts?type=news&limit=10&offset=0`

### Opinionated Packets (What the Frontend Gets)

When the frontend passes an `include` flag, the backend guarantees a specific, immutable data shape.

| Include Flag | Database Action | Resulting JSON Shape |
| --- | --- | --- |
| `author` | Joins `users`. Calculates `isFollowing`. | `{ id, username, displayName, avatarUrl, isFollowing }` |
| `categories` | Joins `post_categories` & `categories`. | `[{ id, name, slug }]` |
| `reputation` | Joins `user_reputation` (Requires `author`). | `{ mpxr: number, level: number }` |
| `viewerContext` | Evaluates SQL `EXISTS` on `reactions`. | `{ isLiked: boolean, isBookmarked: boolean }` |

### Frontend Examples in Action

#### Scenario A: The Lightweight Homepage Card

The UI only needs a thumbnail, title, and the author's basic info.

* **Request:** `GET /api/v1/posts?type=news&limit=10&fields=id,title,slug,featuredImageUrl&include=author`
* **Response:**

```json
{
  "data": [
    {
      "id": 101,
      "title": "AGI is Approaching",
      "slug": "agi-is-approaching",
      "featuredImageUrl": "[https://s3.amazonaws.com/](https://s3.amazonaws.com/)...",
      "author": {
         "id": 5,
         "username": "lewis",
         "displayName": "Ben Goertzel",
         "avatarUrl": "https://..."
      }
    }
  ]
}

```

#### Scenario B: The Full Article Reader

The UI needs the massive HTML body, tags, and whether the logged-in user has already liked the post.

* **Request:** `GET /api/v1/posts/agi-is-approaching?include=author,reputation,categories,tags,viewerContext`
* **Response:**

```json
{
  "data": {
    "id": 101,
    "title": "AGI is Approaching",
    "content": "<p>Full HTML payload here...</p>",
    "author": { 
        "username": "lewis", 
        "reputation": { "mpxr": 8500 } 
    },
    "categories": [ { "id": 2, "name": "AI", "slug": "ai" } ],
    "tags": [ { "id": 9, "name": "Singularity", "slug": "singularity" } ],
    "viewerContext": {
       "isLiked": true,
       "isBookmarked": false
    }
  }
}

```


### Mutations (POST, PATCH, PUT, DELETE)

While `GET` requests utilize dynamic fieldsets and includes, state-changing operations (mutations) adhere strictly to standard REST conventions and explicit Valibot schemas.

#### 1. JSON Payloads & Strict Validation
All request bodies must be `application/json`. We do not accept form-data unless handling explicit file uploads (e.g., avatar changes). Every payload is validated against a Valibot schema before reaching the controller.

* **Example (Update Profile):** `PATCH /api/v1/users/me`

  ```json
  {
    "firstName": "John",
    "theme": "dark"
  }

  ```

#### 2. Sub-Resource Routing for Interactions

We avoid RPC-style action endpoints (e.g., legacy `/wp/v2/like_dislike/post/:slug`). Instead, interactions are treated as sub-resources of the parent entity.

* **Example (Like a Post):** `POST /api/v1/posts/:slug/reactions`

  ```json
  {
    "reaction": "like"
  }

  ```


* **Example (Bookmark a Post):** `POST /api/v1/posts/:slug/bookmarks`

#### 3. Mutation Responses

By default, mutations return the updated state of the resource (or a `201 Created` / `204 No Content` status where applicable). You can optionally append the same `?include=` query parameters to a `PATCH` or `POST` request if the frontend requires the fully hydrated object back immediately after updating.

### Backend Implementation Guide (For Maintainers)

> [!NOTE]
> Will be updated soon.

## API Documentation

Route documentation is auto-generated from the Valibot schemas using `hono-openapi`. Once the server is running, you can access the interactive docs:

* **OpenAPI spec:** `GET /openapi`
* **Scalar UI (Interactive Docs):** `GET /docs`

## Available Commands

We use a `Makefile` to simplify Docker and database operations.

| Command | Description |
| --- | --- |
| `make dev` | Run the full stack with Docker and hot reload |
| `make infra` | Start only PostgreSQL and Redis (to run API locally via Bun) |
| `make down` | Stop all running containers |
| `make nuke` | Stop containers and wipe all persistent data volumes |
| `make db` | Open a PostgreSQL interactive shell |
| `make redis` | Open a Redis interactive CLI |
| `make logs` | Follow API container logs |
| `make migrate` | Run Drizzle database migrations |
| `make seed` | Run the database seed script |
| `make fresh` | Nuke containers -> run migrations -> run seed |

## Contributing

We welcome contributions to the Mindplex Core API. To maintain code quality and architectural consistency, please follow this workflow:

1. **Open an Issue:** Before writing any code, open an issue describing the bug you want to fix or the feature you want to add.
2. **Get Approval:** Wait for a maintainer to review and approve the issue. This ensures your work aligns with the project roadmap.
3. **Open a Pull Request:** Once approved, fork the repository, make your changes on a feature branch, and submit a PR referencing the original issue.