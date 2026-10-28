# Kanban Board Application

> A full-stack Kanban project management application with real-time collaboration, role-based access control, and a clean, modern UI.

**Live Demo:** TBD

---

## Features

1. **User Registration & Login** — Email/password authentication with secure session cookies
2. **Session Management** — Redis-backed server-side sessions with configurable expiry
3. **Project Creation** — Create named projects with descriptions; owner assigned automatically
4. **Member Invitation** — Invite users by email via tokenized invite links; roles assigned on accept
5. **Role-Based Access Control** — `owner` and `member` roles; owners manage membership, members interact with cards
6. **Kanban Columns** — Default columns: To Do, In Progress, Done; custom columns supported
7. **Card Management** — Create, update, move cards across columns with drag-and-drop ordering
8. **Card Assignment** — Assign cards to project members; filter by assignee
9. **Due Dates** — Set and track due dates on cards; overdue highlighting
10. **Labels / Tags** — Create color-coded labels; attach multiple labels to cards
11. **Comments** — Threaded comments on cards; edit and delete own comments
12. **Activity Log** — Immutable audit trail per project: card moves, assignments, comments, membership changes
13. **Password Reset** — Secure token-based password reset flow (email or console in dev)
14. **Pagination & Filtering** — Server-side pagination on cards and activity; filter by label, assignee, column
15. **Soft Delete & Archival** — Archive cards without permanent deletion; restore or hard-delete as owner

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│              React + TypeScript + Vite (port 5173)           │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP / REST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               FastAPI Backend (port 8000)                    │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │    Routers   │  │    Services     │  │  Alembic ORM  │  │
│  │  auth/users  │  │  business logic │  │  migrations   │  │
│  │  projects    │  │  session mgmt   │  │               │  │
│  │  cards/cols  │  │  rate limiting  │  └───────┬───────┘  │
│  │  comments    │  └────────┬────────┘          │          │
│  │  activity    │           │                   │          │
│  └──────────────┘           │                   │          │
└───────────────────────────┬─┴───────────────────┼──────────┘
                            │                     │
              ┌─────────────▼─────┐    ┌──────────▼──────────┐
              │  Redis 7           │    │  PostgreSQL 16       │
              │  (sessions +       │    │  (application data)  │
              │   rate limiting)   │    │                      │
              └────────────────────┘    └─────────────────────┘
```

---

## Technology Stack

| Layer       | Technology                        | Version |
|-------------|-----------------------------------|---------|
| Frontend    | React + TypeScript                | 18 / 5  |
| Build Tool  | Vite                              | 5       |
| Styling     | Tailwind CSS                      | 3       |
| Backend     | FastAPI                           | 0.111+  |
| ORM         | SQLAlchemy (async)                | 2       |
| Migrations  | Alembic                           | 1.13+   |
| Auth        | Server-side sessions (itsdangerous)| —      |
| Database    | PostgreSQL                        | 16      |
| Cache/Sess  | Redis                             | 7       |
| Containers  | Docker + Docker Compose           | 3.9     |
| CI          | GitHub Actions                    | —       |
| Linting     | Ruff (backend), ESLint (frontend) | —       |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24
- [Node.js](https://nodejs.org/) 20 LTS (for local frontend dev)
- [Python](https://www.python.org/) 3.12 (for local backend dev)
- Git

---

## Local Development Setup

### Option A — Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd kanab-stack

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum change SESSION_SECRET_KEY

# 3. Start everything
docker compose up --build
```

Services will be available at:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

### Option B — Local Development (Hot Reload)

#### Step 1 — Clone & configure

```bash
git clone <repo-url>
cd kanab-stack
cp .env.example .env
# Edit .env with your settings
```

#### Step 2 — Start infrastructure services

```bash
docker compose up postgres redis -d
```

#### Step 3 — Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

#### Step 4 — Frontend setup

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

| Variable              | Default                              | Description                                      |
|-----------------------|--------------------------------------|--------------------------------------------------|
| `DATABASE_URL`        | *(required)*                         | Async PostgreSQL URL (`postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC`   | *(required for alembic)*             | Sync PostgreSQL URL (`postgresql://...`)          |
| `REDIS_URL`           | `redis://localhost:6379`             | Redis connection URL                             |
| `SESSION_SECRET_KEY`  | *(required — min 32 chars)*          | Secret for signing session cookies               |
| `COOKIE_SECURE`       | `false`                              | Set `true` in production (requires HTTPS)        |
| `COOKIE_SAMESITE`     | `lax`                                | `strict`, `lax`, or `none`                       |
| `ALLOWED_ORIGINS`     | `http://localhost:5173`              | Comma-separated CORS allowed origins             |
| `RATE_LIMIT_LOGIN`    | `5/minute`                           | Max login attempts per IP per minute             |
| `RATE_LIMIT_REGISTER` | `3/minute`                           | Max registration attempts per IP per minute      |
| `RATE_LIMIT_RESET`    | `3/minute`                           | Max password reset requests per IP per minute    |
| `ENVIRONMENT`         | `development`                        | `development` or `production`                    |
| `SMTP_HOST`           | —                                    | SMTP server hostname (email features)            |
| `SMTP_PORT`           | `587`                                | SMTP server port                                 |
| `SMTP_USER`           | —                                    | SMTP username                                    |
| `SMTP_PASSWORD`       | —                                    | SMTP password                                    |
| `EMAIL_FROM`          | —                                    | Sender address for outgoing emails               |
| `VITE_API_URL`        | `http://localhost:8000`              | Backend URL exposed to the frontend              |

> **Note:** In `development` mode, password reset tokens and invitation URLs are logged to the console instead of being sent via email.

---

## Database Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe your change"

# Roll back one step
alembic downgrade -1

# View migration history
alembic history
```

---

## Seed Data

Populate the database with demo accounts, a sample project, cards, labels, and comments:

```bash
cd backend
python -m scripts.seed
```

### Demo Credentials

| Role   | Email                        | Password        |
|--------|------------------------------|-----------------|
| Owner  | demo_owner@kanban.dev        | DemoOwner123!   |
| Member | demo_member@kanban.dev       | DemoMember123!  |

The seed script is **idempotent** — running it multiple times is safe; existing data is skipped.

---

## Database Schema Overview

```
users
  id, email, hashed_password, display_name, created_at, is_active

projects
  id, name, description, owner_id → users, created_at, archived_at

project_members
  project_id → projects, user_id → users, role (owner|member), joined_at

columns
  id, project_id → projects, name, position, created_at

cards
  id, column_id → columns, project_id → projects, title, description,
  position, assignee_id → users, due_date, archived_at, created_at, updated_at

card_labels           labels
  card_id → cards  ←→  id, project_id, name, color, created_at
  label_id → labels

comments
  id, card_id → cards, author_id → users, body, created_at, updated_at, deleted_at

activity_log
  id, project_id → projects, actor_id → users, entity_type, entity_id,
  action, payload (jsonb), created_at

invite_tokens
  id, project_id → projects, email, role, token (unique), created_by → users,
  accepted_at, expires_at, created_at

password_reset_tokens
  id, user_id → users, token (unique), expires_at, used_at, created_at
```

---

## Security Approach

- **Authentication:** Server-side sessions stored in Redis; session ID in an `HttpOnly` cookie
- **Password hashing:** bcrypt via `passlib`
- **CSRF protection:** `SameSite=Lax` cookie + origin validation
- **Rate limiting:** Per-IP limits on auth endpoints via `slowapi` + Redis
- **Secret rotation:** `SESSION_SECRET_KEY` can be rotated (invalidates all sessions)
- **CORS:** Strict allowlist; credentials mode enabled only for listed origins
- **SQL injection:** Prevented by SQLAlchemy parameterised queries
- **Secrets in CI:** Scanned by TruffleHog on every push

---

## API Overview

### Auth
| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| POST   | `/auth/register`             | Register a new user            |
| POST   | `/auth/login`                | Login and receive session cookie|
| POST   | `/auth/logout`               | Invalidate session             |
| GET    | `/auth/me`                   | Get current user profile       |
| POST   | `/auth/password-reset/request` | Request password reset email |
| POST   | `/auth/password-reset/confirm` | Confirm reset with token     |

### Projects
| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/projects`                  | List user's projects           |
| POST   | `/projects`                  | Create a project               |
| GET    | `/projects/{id}`             | Get project details            |
| PATCH  | `/projects/{id}`             | Update project                 |
| DELETE | `/projects/{id}`             | Archive/delete project         |

### Members & Invitations
| Method | Path                                    | Description                |
|--------|-----------------------------------------|----------------------------|
| GET    | `/projects/{id}/members`               | List project members       |
| DELETE | `/projects/{id}/members/{user_id}`     | Remove member              |
| POST   | `/projects/{id}/invitations`           | Create invitation          |
| POST   | `/invitations/{token}/accept`          | Accept invitation          |

### Columns
| Method | Path                                    | Description                |
|--------|-----------------------------------------|----------------------------|
| GET    | `/projects/{id}/columns`               | List columns               |
| POST   | `/projects/{id}/columns`               | Create column              |
| PATCH  | `/projects/{id}/columns/{col_id}`      | Rename / reorder column    |
| DELETE | `/projects/{id}/columns/{col_id}`      | Delete column              |

### Cards
| Method | Path                                    | Description                |
|--------|-----------------------------------------|----------------------------|
| GET    | `/projects/{id}/cards`                 | List cards (filterable)    |
| POST   | `/projects/{id}/cards`                 | Create card                |
| GET    | `/projects/{id}/cards/{card_id}`       | Get card details           |
| PATCH  | `/projects/{id}/cards/{card_id}`       | Update card                |
| DELETE | `/projects/{id}/cards/{card_id}`       | Archive card               |
| POST   | `/projects/{id}/cards/{card_id}/move`  | Move card to column        |

### Labels
| Method | Path                                    | Description                |
|--------|-----------------------------------------|----------------------------|
| GET    | `/projects/{id}/labels`                | List labels                |
| POST   | `/projects/{id}/labels`                | Create label               |
| PATCH  | `/projects/{id}/labels/{label_id}`     | Update label               |
| DELETE | `/projects/{id}/labels/{label_id}`     | Delete label               |
| POST   | `/projects/{id}/cards/{card_id}/labels`| Attach label to card       |
| DELETE | `/projects/{id}/cards/{card_id}/labels/{label_id}` | Detach label |

### Comments
| Method | Path                                            | Description         |
|--------|-------------------------------------------------|---------------------|
| GET    | `/projects/{id}/cards/{card_id}/comments`      | List comments       |
| POST   | `/projects/{id}/cards/{card_id}/comments`      | Add comment         |
| PATCH  | `/projects/{id}/cards/{card_id}/comments/{cid}`| Edit comment        |
| DELETE | `/projects/{id}/cards/{card_id}/comments/{cid}`| Delete comment      |

### Activity
| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/projects/{id}/activity`    | Paginated activity log         |

---

## Testing

```bash
cd backend

# Run all tests with coverage
pytest tests/ -v --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_auth.py -v

# Run tests matching a keyword
pytest tests/ -k "card" -v
```

Tests use a dedicated test database (configured via `TEST_DATABASE_URL`) and isolated sessions.

---

## Known Limitations & Future Improvements

- **File attachments:** File upload on cards not yet implemented (S3-ready design)
- **OAuth / SSO:** Only email/password auth; Google/GitHub OAuth planned
- **Email delivery:** Password reset and invitation emails are logged to console in dev (SMTP config ready for production)
- **Multi-board projects:** Currently one board (set of columns) per project
- **Audit log export:** Activity log is viewable in-app; CSV/JSON export endpoint planned
- **Push notifications:** In-app notification centre not yet built (WebSocket events broadcast to all board members)

---

## AI Tools Disclosure

> Architecture and assignment brief written by the project author.
> **Antigravity (Google Deepmind)** AI coding assistant was used to scaffold and implement the full codebase.
