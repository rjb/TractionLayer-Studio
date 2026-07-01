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

### Auth & access gating (Supabase, Google OAuth only)

- `lib/supabase.ts` — browser client (`createBrowserClient`), used in client components like `app/login/page.tsx` and `components/Navbar.tsx`.
- `lib/supabase-server.ts` — three server-side client constructors, each for a different cookie-handling context:
  - `createServerSupabaseClient()` — Server Components/Actions, reads `next/headers` cookies.
  - `createRouteHandlerSupabaseClient(request, response)` — Route Handlers (e.g. `app/auth/callback/route.ts`).
  - `createProxySupabaseClient(request, response)` — `proxy.ts` only; writes refreshed cookies onto both the request and response.
- Login flow: `app/login/page.tsx` triggers `signInWithOAuth({ provider: 'google' })` → Google → `app/auth/callback/route.ts` exchanges the code for a session and redirects to `/workflows`. The callback honors `x-forwarded-host`/`x-forwarded-proto` to build the redirect origin correctly behind a proxy/load balancer.
- Authorization is checked **twice, redundantly, in different layers**, both against `profiles.role === 'APPROVED'`:
  1. `proxy.ts` gates `/workflows/:path*` at the edge (redirects to `/login` if unauthenticated, `/account-pending` if not approved).
  2. `app/workflows/page.tsx` and `app/workflows/[id]/page.tsx` re-check the same thing server-side on render (Proxy is documented as an optimistic check only, not a full authz solution — see the vendored docs above).
  3. `app/api/execute-workflow/route.ts` checks it again independently (an API route is reachable directly, not just via the gated pages), and returns 401/403 JSON rather than redirecting.
- `lib/profile.ts` (`getProfile(supabase, userId)`) is the shared helper for fetching `{ role, client_tag }` — used by all three of the call sites above so the shape stays in one place.

### Workflows: DB-backed, per-tenant via `client_tag`

- `lib/workflows.ts` holds the shared types (`WorkflowRow`, `WorkflowInputField`, `ValidationRule`) mirroring the `workflows` table, plus `validateField()` — the single implementation of per-field validation (`url` / `domain` / `youtube`) shared by the client-side `onBlur` check and the server-side check in the execute-workflow route, so they can't drift.
- **Output contract**: `WorkflowOutput` (also in `lib/workflows.ts`) is the *only* shape a workflow webhook may return — `{ kind: 'markdown', data: string }` or `{ kind: 'error', message: string }`. There is no per-workflow output type or per-workflow rendering branch anywhere in the frontend; `WorkflowForm.tsx` does one `switch` on `kind`. If you're tempted to add a bespoke field to a webhook response (e.g. a list of structured objects), the convention is to format it into the `data` markdown string on the n8n side instead, not to add a new `kind` or a new frontend branch for one workflow. New `kind`s (e.g. `table`, `file`) are added deliberately, project-wide, not per-workflow. See the n8n contract doc for the exact wire format n8n developers must return.
- `lib/workflows-data.ts` is the only place that queries the `workflows` table (`getActiveWorkflowsForClientTag`, `getActiveWorkflowForClientTag`) — both always filter by `client_tag` and `is_active` at the query level, not just in application logic, so cross-tenant access isn't possible even if a caller forgets to double-check.
- `app/workflows/page.tsx` (Server Component) fetches the signed-in user's `client_tag` via `getProfile`, then lists their active workflows.
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

`.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_MASTER_SECRET`. `API_MASTER_SECRET` is also required (used by the `/v1/*` routes) but missing from the example file.

## Supabase Database Schema

The application uses a flat multi-tenant model ("High-Leverage Solo") mapped by `client_tag`. Below are the load-bearing tables relevant for full-stack feature development. This supersedes an earlier draft of this doc that omitted `profiles.role`/`full_name` and used a `uuid` for `workflows.id` — the schema below is what the app code (`proxy.ts`, `lib/profile.ts`, `lib/workflows.ts`) actually targets, with `id` as `text` to match human-readable slugs like `substack-to-blog`.

### profiles
```sql
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  role text not null default 'UNAPPROVED', -- 'UNAPPROVED' | 'APPROVED'
  email text,
  client_tag text not null default 'unassigned',
  created_at timestamptz default now()
);
```
`role` gates access (see Auth & access gating above); `client_tag` scopes which `workflows` rows a user can see/execute.

### workflows
```sql
create table public.workflows (
  id text primary key,
  client_tag text not null default 'unassigned',
  name text not null,
  description text,
  webhook_url text not null,
  http_method text default 'POST',
  auth_type text default 'none', -- 'none' | 'x-n8n-secret' | 'bearer'
  action_verb text default 'Execute',
  inputs jsonb default '[]'::jsonb,   -- Array<{name: string, placeholder?: string, type?: string}>
  validations jsonb default '{}'::jsonb, -- Record<string, Array<{type: string, message: string, domain?: string}>>
  is_active boolean default true,
  created_at timestamptz default now()
);
```
Mirrored as `WorkflowRow` in `lib/workflows.ts`. Only `is_active = true` rows scoped to the caller's `client_tag` are ever fetched (`lib/workflows-data.ts`) — there is no app-level path that reads another tenant's workflows.

New tables need both a `grant select ... to authenticated` and an RLS policy scoping rows to `client_tag` — a `grant` without RLS exposes every tenant's rows to every signed-in user, and RLS enabled with no matching `grant` fails loudly with "permission denied for table X" (not a silent empty result) the first time a Server Component queries it.
