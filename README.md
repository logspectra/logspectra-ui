# LogSpectra UI

Production-ready Next.js dashboard for log exploration, analytics, real-time monitoring, and AI-assisted analysis.

This UI is designed to run:
- locally with the backend on `localhost`
- inside Docker with runtime API URL injection
- against different backend environments without rebuilding the image

## Highlights

- Next.js App Router frontend (React + TypeScript)
- Runtime API base URL configuration via `public/env-config.js`
- JWT-based authenticated API calls
- Real-time features via SSE-backed backend endpoints
- Dockerized production deployment with health checks

## Architecture Overview

```
Browser
  -> Next.js UI (app routes + components)
  -> lib/api.ts (typed API client)
  -> Backend REST + SSE APIs (/api/v1/*)

Runtime Config Path:
Docker env NEXT_PUBLIC_API_BASE_URL
  -> docker-entrypoint.sh
  -> /public/env-config.js
  -> window.__LOGSPECTRA_ENV.NEXT_PUBLIC_API_BASE_URL
  -> lib/api.ts getApiBaseUrl()
```

## UI Folder Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI and feature components.
- `lib/api.ts`: Centralized API client and request orchestration.
- `lib/types.ts`: Shared UI/domain types.
- `hooks/`: UI hooks.
- `docker-entrypoint.sh`: Writes runtime browser config.
- `Dockerfile`: Multi-stage production build.
- `docker-compose.yml`: Standalone UI container run config.

## Prerequisites

- Node.js 20+
- pnpm
- Backend API reachable (default: `http://localhost:8080`)

## Local Development

Install dependencies:

```bash
pnpm install
```

Start dev server:

```bash
pnpm dev
```

Open:

- `http://localhost:3000` (default Next.js dev port)

## Production Build (Local)

```bash
pnpm build
pnpm start
```

By default, production server runs on the `PORT` environment variable (or framework default if unset).

## Runtime API Configuration

Primary variable used by the UI:

- `NEXT_PUBLIC_API_BASE_URL`

Resolution order in `lib/api.ts`:

1. `window.__LOGSPECTRA_ENV.NEXT_PUBLIC_API_BASE_URL` (runtime injected)
2. `process.env.NEXT_PUBLIC_API_BASE_URL` (build-time)
3. fallback `http://localhost:8080`

### Important Networking Note

If the UI runs in a browser on your host machine, browser requests cannot resolve internal Docker service names like `logspectra-backend`.

Use host-reachable URLs such as:

- `http://localhost:8080`

Use container DNS names only for container-to-container communication, not browser-to-container resolution.

## Docker

Build image:

```bash
docker build -t logspectra/logspectra-ui:1.0.0 .
```

Run image:

```bash
docker run --name logspectra-ui -p 3050:3050 -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 logspectra/logspectra-ui:1.0.0
```

Compose run (UI only):

```bash
docker compose up -d --build
```

## Quality and Linting

Run lint:

```bash
pnpm lint
```

## Integration with Backend

Expected backend API base:

- `/api/v1/auth/login`
- `/api/v1/logs/stream`
- `/api/v1/logs/analyze`
- project, users, severity-rules, analytics endpoints under `/api/v1/*`

For full-stack local setup, ensure backend and required infra are running before validating UI flows.

## Troubleshooting

- `ERR_NAME_NOT_RESOLVED` for backend host:
  - set `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:8080` for browser-based access.
- UI loads but API requests fail:
  - verify backend is running and exposed on host port.
- Runtime env not reflected:
  - confirm `docker-entrypoint.sh` is executing and `public/env-config.js` is generated.

## Contributing

Please read `CONTRIBUTING.md` before opening a PR.

Contribution is issue-first: create an issue and get alignment before implementation.
