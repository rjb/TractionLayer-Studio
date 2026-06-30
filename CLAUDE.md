@AGENTS.md

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