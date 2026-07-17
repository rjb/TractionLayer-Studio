# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js 16, Turbopack)
npm run build    # Production build
npm run start    # Run production build
npm run lint     # ESLint (eslint-config-next core-web-vitals + typescript)
```

There is no test suite configured in this repo.

## Next.js 16: read the vendored docs before assuming API behavior

This project pins `next@16.2.9`, which postdates your training data and has real breaking changes from the Next.js you know. Docs are vendored at `node_modules/next/dist/docs/`. Notably:

- **`middleware.ts` does not exist in this version — it's `proxy.ts`** at the project root (`proxy.ts:1`), exporting a `proxy()` function instead of `middleware()`. Functionality is the same, naming changed in Next 16. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- Before relying on any other App Router API you're not 100% current on, check the matching file under `node_modules/next/dist/docs/01-app/`.

## Architecture

This is a client portal for TractionLayer: authenticated users trigger n8n automation workflows (e.g. "Substack to Blog", "YouTube Insight Miner") through forms, and the result is rendered back in the UI.

### Auth & access gating (Better-Auth, Drizzle/MySQL, Google OAuth only)

- `lib/db.ts` — the Drizzle MySQL connection (`drizzle-orm/mysql2`), reads `DATABASE_URL`. Every server-side DB access in the app goes through this one instance.
- `lib/auth.ts` — the `betterAuth()` instance. Wires the Drizzle adapter (`better-auth/adapters/drizzle`, `provider: "mysql"`) to `lib/db.ts`, enables `emailAndPassword` and `socialProviders.google` (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), and declares `user.additionalFields` for `role` and `client_tag` — these two are the whole authorization model and live directly on the better-auth `user` row (see schema below), not in a separate `profiles` table. Both are `input: false`, so they can't be self-assigned at signup; an admin/backend process has to set them.
- `app/api/auth/[...all]/route.ts` — the Better-Auth catch-all route (`toNextJsHandler(auth)`). Handles sign-in, sign-out, session reads, and the Google OAuth callback (`/api/auth/callback/google`) — there is no bespoke `app/auth/callback/route.ts` the way there was under Supabase; better-auth owns the entire OAuth round trip once `signIn.social` kicks it off.
- `lib/auth-client.ts` — the browser-side client (`createAuthClient` from `better-auth/react`), re-exporting `signIn`, `signOut`, `useSession`. Used in client components like `app/login/page.tsx` (`signIn.social({ provider: 'google', callbackURL: '/workflows' })`, `useSession()`) and `components/Navbar.tsx` (`signOut()`).
- Session reads are **always** `auth.api.getSession({ headers })`, but the headers source differs by context — this is a Next.js constraint, not a style choice:
  - Server Components / Route Handlers: `await headers()` from `next/headers` (works inside the App Router request scope).
  - `proxy.ts`: `request.headers` directly — `next/headers`'s `headers()` is *not* available in Proxy, since Proxy runs before the React Server render scope is established. Passing `request.headers` is also what upstream better-auth's own Next.js proxy/middleware guide recommends.
- `proxy.ts` doing a real DB-backed session lookup (rather than just checking for a cookie's presence) only works because **Next.js 16 defaults Proxy to the Node.js runtime**, not Edge (this changed from Next 15's Edge default — see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Runtime" section). `mysql2` is a Node.js TCP driver and cannot run on the Edge runtime; if this project's Proxy runtime ever changes, the session check in `proxy.ts` has to move to a cookie-presence-only check instead.
- Authorization is checked **twice, redundantly, in different layers**, both against `session.user.role === 'APPROVED'`:
  1. `proxy.ts` gates `/workflows/:path*` (redirects to `/login` if unauthenticated, `/account-pending` if not approved).
  2. `app/workflows/page.tsx` and `app/workflows/[id]/page.tsx` re-check the same thing server-side on render (Proxy is documented as an optimistic check only, not a full authz solution — see the vendored docs above).
  3. `app/api/execute-workflow/route.ts` checks it again independently (an API route is reachable directly, not just via the gated pages), and returns 401/403 JSON rather than redirecting.
- There is no `getProfile()`-style helper anymore — `role` and `client_tag` come back directly on `session.user` from `auth.api.getSession()`, since they're better-auth `additionalFields` rather than a joined table, so every call site reads them inline.

### Workflows: DB-backed, per-tenant via `client_tag`

- `lib/workflows.ts` holds the shared types (`WorkflowRow`, `WorkflowInputField`, `ValidationRule`) mirroring the `workflows` table, plus `validateField()` — the single implementation of per-field validation (`url` / `domain` / `youtube`) shared by the client-side `onBlur` check and the server-side check in the execute-workflow route, so they can't drift.
- **Output contract**: `WorkflowOutput` (also in `lib/workflows.ts`) is the *only* shape a workflow webhook may return — `{ kind: 'markdown', data: string }` or `{ kind: 'error', message: string }`. There is no per-workflow output type or per-workflow rendering branch anywhere in the frontend; `WorkflowForm.tsx` does one `switch` on `kind`. If you're tempted to add a bespoke field to a webhook response (e.g. a list of structured objects), the convention is to format it into the `data` markdown string on the n8n side instead, not to add a new `kind` or a new frontend branch for one workflow. New `kind`s (e.g. `table`, `file`) are added deliberately, project-wide, not per-workflow. See the n8n contract doc for the exact wire format n8n developers must return.
- `lib/workflows-data.ts` is the only place that queries the `workflows` table (`getActiveWorkflowsForClientTag`, `getActiveWorkflowForClientTag`, both via Drizzle against `lib/db/schema/workflows.ts`) — both always filter by `client_tag` and `is_active` at the query level, not just in application logic, so cross-tenant access isn't possible even if a caller forgets to double-check. Each also maps the Drizzle row (camelCase columns) back to the `WorkflowRow` shape (snake_case fields) that the rest of the app expects, so `lib/workflows.ts` didn't need to change shape across the migration.
- `app/workflows/page.tsx` (Server Component) reads `client_tag` off `session.user`, then lists their active workflows.
- `app/workflows/[id]/page.tsx` (Server Component) fetches the single workflow scoped to that `client_tag`, then renders `app/workflows/[id]/WorkflowForm.tsx` (Client Component) with it as a prop. The form does **not** know the webhook URL or any secret — it only knows the workflow's `id`, `inputs`, and `validations`.
- **Execution proxy**: the form POSTs `{ workflowId, formData }` as JSON to `app/api/execute-workflow/route.ts`. That route re-verifies auth + tenant ownership, re-runs field validation server-side, looks up `webhook_url` / `http_method` / `auth_type` from the DB row, injects `N8N_MASTER_SECRET` as `Authorization: Bearer` or `X-N8N-Secret` depending on `auth_type`, and forwards the request. The webhook URL and secret never reach the browser.
- The route is an **opaque pass-through for the webhook's response body** — it checks the response matches `WorkflowOutput` (via `isWorkflowOutput()`) and relays it verbatim; it never reads or branches on workflow-specific fields inside it. Everything before that (auth, tenant ownership, field validation) is proxy-level guardrail logic, not output-schema logic, and stays.
- The route maps outcomes to HTTP status: `401` not signed in, `403` not approved, `400` bad payload or failed field validation, `404` workflow not found/inactive/wrong tenant, `502` webhook unreachable, returned a non-`WorkflowOutput` shape, or itself returned `kind: 'error'`, `200` on `kind: 'markdown'`. The client (`WorkflowForm.tsx`) still ultimately trusts `body.kind`, not `response.ok`, to decide what to render — the status codes are informational/for logging, not the source of truth for the UI.
- This intentionally replaces the old `'use server'` Server Action approach (`app/workflows/[id]/actions.ts`, now deleted) — a dedicated Route Handler was chosen so the proxy boundary is a normal authenticated API endpoint rather than something only reachable from one specific form.

### `/v1/*` routes: separate API surface for n8n to call back into

- `app/v1/substack-post/route.ts` and `app/v1/youtube-transcript/route.ts` are Bearer-token-gated GET endpoints (`API_MASTER_SECRET`, distinct from `N8N_MASTER_SECRET`) that n8n workflows call to scrape/transcribe content. These are not used by the frontend — they're inbound API endpoints for the automation backend.
- Response shape convention: always a JSON array with one object, `{ success: true, data: {...} }` or `{ success: false, error: "..." }`.
- `API_MASTER_SECRET` is required at runtime by both but is **not** listed in `.env.example` — add it locally when working on these routes.

### Environment variables

`.env.example` lists `DATABASE_URL` (MySQL connection string, consumed by both `lib/db.ts` and `drizzle.config.ts`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `N8N_MASTER_SECRET`. `API_MASTER_SECRET` is also required (used by the `/v1/*` routes) but missing from the example file. `BETTER_AUTH_SECRET` isn't optional the way it might look — `betterAuth()` throws at startup if it's unset, in dev as well as production.

## MySQL Database Schema (Drizzle + Better-Auth)

The app was migrated off Supabase (both auth and Postgres) onto Better-Auth + Drizzle + MySQL. It keeps a flat multi-tenant model ("High-Leverage Solo") mapped by `client_tag`, same as before — only the storage layer and the auth provider changed.

### Schema files are split, deliberately

- `lib/db/schema/auth.ts` — **generated**, not hand-edited. Owned by `npx @better-auth/cli generate --output lib/db/schema/auth.ts`, which reads `lib/auth.ts` and **overwrites this file wholesale** on every run ("Schema was overwritten successfully"). Defines `user`, `session`, `account`, `verification` (+ relations).
- `lib/db/schema/workflows.ts` — **hand-written** app data, kept in its own file for exactly one reason: if it lived in the same file as the generated auth tables, the next `better-auth generate` run would silently delete it.
- `lib/db/schema/index.ts` — re-exports both. `lib/db.ts` and `lib/auth.ts` both import `* as schema from '@/lib/db/schema'` (the directory, resolved via `index.ts`) rather than either file directly, so neither has to know about the split.
- `drizzle.config.ts` points `schema` at the glob `./lib/db/schema/*.ts` (not a single file) so `drizzle-kit generate`/`migrate` picks up both.
- After editing `lib/auth.ts` (e.g. adding another `additionalFields` entry or social provider), the loop is always: `npx @better-auth/cli generate --output lib/db/schema/auth.ts` → `npm run db:generate` → commit the new file(s) under `./drizzle` → `npm run db:migrate` (prod) / `npm run db:migrate:local` (dev). The better-auth CLI needs env vars that live in `.env.local`, which it doesn't auto-load (only `.env` is loaded by default) — run it as `node --env-file=.env.local node_modules/.bin/<tool> ...` or equivalent.

### Migrations: journaled, not `push`

- Schema changes go through Drizzle's journaled migrate workflow, not `drizzle-kit push`. `./drizzle/` holds the generated SQL migration files plus `meta/_journal.json`, and is committed to git — it's the single source of truth for what's been applied and in what order, tracked in a `__drizzle_migrations` table Drizzle creates in the target DB.
- `npm run db:generate` — diffs `lib/db/schema/*.ts` against the last migration and writes a new file under `./drizzle`. Loads `.env.local` explicitly (via `node --env-file`), so it only ever runs against your local dev DB. Always run this locally, review the generated SQL, then commit it.
- `npm run db:migrate:local` — applies pending migrations to your local dev DB (also loads `.env.local`).
- `npm run db:migrate` — applies pending migrations wherever it's run, reading `DATABASE_URL` from the real process environment. Deliberately has **no** `.env.local` loading, since `.env.local` is a dev-only file that shouldn't exist on the production VPS — there, `DATABASE_URL` is already set in the real environment the app itself runs under. This is the command to run in prod after deploying a commit that adds new migration files.

### user (`lib/db/schema/auth.ts`, generated)
Standard better-auth columns (`id`, `name`, `email`, `emailVerified`, `image`, timestamps) plus two `additionalFields` declared in `lib/auth.ts`:
```ts
role: text("role").default("UNAPPROVED").notNull()        // 'UNAPPROVED' | 'APPROVED'
client_tag: text("client_tag").default("unassigned").notNull()
```
`role` gates access (see Auth & access gating above); `client_tag` scopes which `workflows` rows a user can see/execute. Both are `input: false` in `lib/auth.ts` — never settable by the user themselves via sign-up or the client SDK, only by direct DB write. There is no separate `profiles` table the way Supabase had one; this **is** the profile.

### session / account / verification (`lib/db/schema/auth.ts`, generated)
Standard better-auth tables — session tokens, linked OAuth accounts (Google), and email verification/reset tokens. Not hand-modified; if you need something here, change `lib/auth.ts` and regenerate rather than editing the file directly.

### workflows (`lib/db/schema/workflows.ts`, hand-written)
```ts
export const workflows = mysqlTable("workflows", {
  id: varchar("id", { length: 255 }).primaryKey(),        // UUID, e.g. "29fa8a33-7af6-11f1-8851-b641c0ed86fc" (not a slug, despite the column being a free-form varchar)
  clientTag: varchar("client_tag", { length: 255 }).notNull().default("unassigned"),
  name: varchar("name", { length: 255 }).notNull(),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  webhookUrl: text("webhook_url").notNull(),
  httpMethod: varchar("http_method", { length: 16 }).default("POST"),
  authType: mysqlEnum("auth_type", ["none", "x-n8n-secret", "bearer"]).default("none"),
  actionVerb: varchar("action_verb", { length: 64 }).default("Execute"),
  inputs: json("inputs").$type<WorkflowInputField[]>().notNull().default([]),
  validations: json("validations").$type<Record<string, ValidationRule[]>>().notNull().default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
}, (table) => [index("workflows_clientTag_idx").on(table.clientTag)])
```
Drizzle/MySQL columns are camelCase; `lib/workflows-data.ts` maps rows back to the snake_case `WorkflowRow` shape (`lib/workflows.ts`) the rest of the app expects, so nothing above the data layer had to change across the migration. Only `is_active = true` rows scoped to the caller's `client_tag` are ever fetched, filtered at the query level (not just in application logic) — there is no app-level path that reads another tenant's workflows.

There is no RLS layer anymore (MySQL, not Postgres) — `client_tag` scoping in `lib/workflows-data.ts`'s `WHERE` clauses is the *only* tenant boundary for this table now. Any new query against `workflows` (or a future table following the same multi-tenant pattern) must filter by `client_tag` itself; there's no database-level backstop like Supabase's RLS policies used to provide.
