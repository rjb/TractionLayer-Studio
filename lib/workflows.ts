export type WorkflowInputField = {
  name: string
  placeholder?: string
  type?: string
}

export type ValidationRule =
  | { type: 'url'; message: string }
  | { type: 'domain'; domain: string; message: string }
  | { type: 'youtube'; message: string }

export type WorkflowAuthType = 'none' | 'x-n8n-secret' | 'bearer'

// Mirrors the public.workflows table.
export type WorkflowRow = {
  id: string
  client_tag: string
  name: string
  description: string | null
  webhook_url: string
  http_method: string
  auth_type: WorkflowAuthType
  action_verb: string
  inputs: WorkflowInputField[]
  validations: Record<string, ValidationRule[]>
  is_active: boolean
  created_at: string
}

export function isValidYouTubeUrlOrId(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const idPattern = /^[A-Za-z0-9_-]{11}$/
  if (idPattern.test(trimmed)) return true

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split(/[/?#]/)[0]
      return idPattern.test(id)
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v')
      if (id && idPattern.test(id)) return true

      const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/)
      if (embedMatch) return true
    }
  } catch {
    return false
  }

  return false
}

// Runs a single validation rule against a value, returning an error message
// or an empty string. Shared between the client-side onBlur check and the
// server-side check in the execute-workflow proxy, so the two never drift.
export function runValidationRule(rule: ValidationRule, value: string): string {
  if (rule.type === 'url') {
    try {
      new URL(value)
    } catch {
      return rule.message
    }
    return ''
  }

  if (rule.type === 'domain') {
    try {
      const url = new URL(value)
      if (url.hostname !== rule.domain) {
        return rule.message
      }
    } catch {
      return rule.message
    }
    return ''
  }

  if (rule.type === 'youtube') {
    if (!isValidYouTubeUrlOrId(value)) {
      return rule.message
    }
    return ''
  }

  return ''
}

// The declarative contract every workflow webhook must return, and the only
// shape /api/execute-workflow and the frontend ever look at. Scalable to new
// kinds ('table', 'file', ...) without touching call sites that don't care.
export type WorkflowOutput =
  | { kind: 'markdown'; data: string }
  | { kind: 'error'; message: string }

export function isWorkflowOutput(value: unknown): value is WorkflowOutput {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>

  if (record.kind === 'markdown') return typeof record.data === 'string'
  if (record.kind === 'error') return typeof record.message === 'string'

  return false
}

export function validateField(
  workflow: Pick<WorkflowRow, 'validations'>,
  fieldName: string,
  value: string
): string {
  const rules = workflow.validations?.[fieldName]
  if (!rules) return ''

  for (const rule of rules) {
    const message = runValidationRule(rule, value)
    if (message) return message
  }

  return ''
}
