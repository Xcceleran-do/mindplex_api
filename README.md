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

## API Documentation

Route documentation is auto-generated from the Valibot schemas using `hono-openapi`. Once the server is running, you can access the interactive docs:

* **OpenAPI spec:** `GET /openapi`
* **Scalar UI (Interactive Docs):** `GET /docs`

## Project Structure

```text
src/
├── db/
│   └── schema.ts          # Drizzle ORM table definitions and relations
├── lib/
│   ├── env.ts             # Typed environment validation
│   ├── tokens.ts          # Token generation, hashing, and verification
│   └── openapi.ts         # Scalar UI and OpenAPI registration
├── middleware/
│   └── auth.ts            # requireAuth and role-based access middleware
├── routes/
│   └── auth/
│       ├── index.ts       # Route handlers (Login, Register, Social, Refresh)
│       └── schema.ts      # Valibot validation schemas
├── types.ts               # Hono AppContext and global types
└── index.ts               # Application entrypoint

```

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

---

Is this closer to what you need for the repository root? If so, would you like to move forward with implementing the rate limiter, or should we start building out the User Profile endpoints?