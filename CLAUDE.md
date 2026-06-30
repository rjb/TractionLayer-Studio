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
  2. `app/workflows/page.tsx` re-checks the same thing server-side on render (Proxy is documented as an optimistic check only, not a full authz solution — see the vendored docs above).
- Note: `profiles.role` is checked throughout the app code, but is **not** part of the schema documented below (which only lists `client_tag`). Treat the CLAUDE.md schema section as the multi-tenant target state, not necessarily what every route currently reads/writes — verify against actual Supabase state if behavior seems inconsistent.

### Workflows: hardcoded today, DB-backed is the target state

- `lib/workflows.ts` currently defines `WORKFLOWS: Workflow[]` as a **hardcoded array** (webhook URLs, input fields, validation rules, auth type all live in code).
- The `workflows` table described in the Supabase schema section below represents where this is migrating to — same shape, but per-tenant (`client_tag`) and editable without a deploy. When adding workflow CRUD or making workflows dynamic, this is the target to build toward (current branch: `stu-49-phase-2-full-stack-execution-engine`).
- `app/workflows/page.tsx` lists workflows; `app/workflows/[id]/page.tsx` renders the dynamic form (client component) and posts via `app/workflows/[id]/actions.ts` (`'use server'`).
- `runAutomation()` in `actions.ts` POSTs form data as JSON to `workflow.webhookUrl`, auth'd with `N8N_MASTER_SECRET` as either `Authorization: Bearer` or `X-N8N-Secret` depending on `workflow.authType`. It normalizes the n8n response (`status`/`message`/`markdown_output`/`structured_concepts`) into a single `AutomationResult` shape consumed by the UI.
- Field validation (`url` / `domain` / `youtube`) is defined declaratively per-workflow in `validations` and run **twice**: client-side `onBlur` in the page component, and again server-side inside the Server Action before the webhook call — keep both in sync if you touch validation logic.

### `/v1/*` routes: separate API surface for n8n to call back into

- `app/v1/substack-post/route.ts` and `app/v1/youtube-transcript/route.ts` are Bearer-token-gated GET endpoints (`API_MASTER_SECRET`, distinct from `N8N_MASTER_SECRET`) that n8n workflows call to scrape/transcribe content. These are not used by the frontend — they're inbound API endpoints for the automation backend.
- Response shape convention: always a JSON array with one object, `{ success: true, data: {...} }` or `{ success: false, error: "..." }`.
- `API_MASTER_SECRET` is required at runtime by both but is **not** listed in `.env.example` — add it locally when working on these routes.

### Environment variables

`.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_MASTER_SECRET`. `API_MASTER_SECRET` is also required (used by the `/v1/*` routes) but missing from the example file.

## Supabase Database Schema (Target State)
The application uses a flat multi-tenant model mapped by `client_tag`. Below are the load-bearing tables relevant for full-stack feature development:

### profiles
- `id` (uuid, primary key, references auth.users)
- `email` (text)
- `client_tag` (text, default 'unassigned') - Links users to their workspace/workflows.

### workflows
- `id` (uuid, primary key)
- `client_tag` (text, default 'unassigned')
- `name` (text, not null)
- `description` (text, nullable)
- `webhook_url` (text, not null)
- `http_method` (text, default 'POST')
- `auth_type` (text, default 'none') - Enum values: 'none' | 'x-n8n-secret' | 'bearer'
- `action_verb` (text, default 'Execute')
- `inputs` (jsonb, default '[]'::jsonb) - Array of form fields: Array<{name: string, placeholder?: string, type?: string}>
- `validations` (jsonb, default '{}'::jsonb) - Schema layout: Record<string, Array<{type: string, message: string, domain?: string}>>
- `is_active` (boolean, default true)
- `created_at` (timestamptz)
