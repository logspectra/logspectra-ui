# Contributing to LogSpectra UI

Thanks for helping improve LogSpectra UI. This guide defines how to contribute safely and efficiently.

## Mandatory Issue-First Policy

Before writing code, you must create or reference an issue.

Required flow:

1. Create an issue first (bug, feature, refactor, docs, performance, accessibility).
2. Wait for triage/acknowledgement by a maintainer.
3. Create a branch tied to that issue.
4. Implement and test your change.
5. Open a PR that links the issue.

PRs without a linked issue may be closed or asked to restart through the issue workflow.

## Contribution Workflow

1. Pick or create issue.
2. Fork and branch from `main`.
3. Keep changes focused and small.
4. Run lint/tests and manual checks.
5. Submit PR with clear description and screenshots when UI changes are involved.

## Local Setup

Prerequisites:

- Node.js 20+
- pnpm
- Backend service available (default expected base URL: `http://localhost:8080`)

Install:

```bash
pnpm install
```

Run dev server:

```bash
pnpm dev
```

Lint:

```bash
pnpm lint
```

## Branch Naming

Use issue number in branch names whenever possible:

- `feature/123-add-anomaly-widget`
- `fix/456-login-api-timeout`
- `docs/789-update-runtime-config-guide`

## Commit Guidelines

- Use clear, imperative commit messages.
- Keep unrelated changes out of the same commit.
- Prefer multiple small commits over one large commit.

Examples:

- `Fix login error toast handling`
- `Add API timeout for stream endpoint`
- `Document runtime API URL behavior`

## UI Architecture Expectations

Follow existing layering and boundaries:

- Route and page composition in `app/`
- Reusable presentation components in `components/`
- API orchestration in `lib/api.ts`
- Shared types in `lib/types.ts`

When adding features:

- avoid duplicating API request logic across pages
- keep typed DTO mapping in API layer
- preserve auth header/project context behavior
- do not hardcode environment-specific URLs in components

## API and Runtime Config Rules

- API base URL must come from runtime/build config, not hardcoded values in feature components.
- Preserve the current resolution flow (`window.__LOGSPECTRA_ENV` -> build env -> localhost fallback).
- Be careful with Docker DNS names: browser clients cannot resolve internal service names.

## Testing Expectations

At minimum for non-trivial changes:

- `pnpm lint` passes
- key user flow manually verified (login, dashboard data load, at least one API-backed page)
- include before/after screenshots for visible UI changes

For bug fixes:

- include clear reproduction steps in PR
- explain why the fix works and what edge cases were checked

## Pull Request Requirements

Every PR should include:

- linked issue (for example: `Closes #123`)
- concise summary of what changed
- why the change was needed
- how it was tested
- screenshots/GIF for UI changes
- migration or config notes (if any)

## PR Review Checklist

- [ ] Issue exists and is linked
- [ ] Scope is focused and understandable
- [ ] Lint passes locally
- [ ] No secrets or sensitive data committed
- [ ] Runtime configuration behavior remains correct
- [ ] UI states handled (loading, empty, error)

## Security and Secrets

- Never commit API keys, tokens, or secrets.
- Do not log sensitive auth data in browser console.
- Keep authentication flows and token handling consistent with existing patterns.

## Communication

If requirements are ambiguous, ask in the issue before implementing.

Early design notes and small implementation plans in issue comments are encouraged for faster review.

Thanks for contributing.
