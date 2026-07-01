import { type NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerSupabaseClient } from '@/lib/supabase-server'
import { getProfile } from '@/lib/profile'
import { getActiveWorkflowForClientTag } from '@/lib/workflows-data'
import { validateField, isWorkflowOutput, type WorkflowOutput } from '@/lib/workflows'

function jsonWithRefreshedCookies(
  cookieCarrier: NextResponse,
  body: WorkflowOutput,
  status: number
) {
  const response = NextResponse.json(body, { status })
  for (const cookie of cookieCarrier.cookies.getAll()) {
    response.cookies.set(cookie)
  }
  return response
}

export async function POST(request: NextRequest) {
  const cookieCarrier = new NextResponse()
  const supabase = createRouteHandlerSupabaseClient(request, cookieCarrier)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      { kind: 'error', message: 'Unauthorized: please sign in again.' },
      401
    )
  }

  const profile = await getProfile(supabase, user.id)

  if (!profile || profile.role !== 'APPROVED') {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      { kind: 'error', message: 'Forbidden: your account is not approved.' },
      403
    )
  }

  let payload: { workflowId?: unknown; formData?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      { kind: 'error', message: 'Bad Request: invalid JSON body.' },
      400
    )
  }

  if (typeof payload.workflowId !== 'string' || typeof payload.formData !== 'object' || payload.formData === null) {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      { kind: 'error', message: 'Bad Request: missing workflowId or formData.' },
      400
    )
  }

  const formData = payload.formData as Record<string, unknown>

  const workflow = await getActiveWorkflowForClientTag(supabase, payload.workflowId, profile.client_tag)

  if (!workflow) {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      { kind: 'error', message: 'Not Found: workflow does not exist for your account.' },
      404
    )
  }

  const body: Record<string, string> = {}

  for (const [key, value] of Object.entries(formData)) {
    const fieldValue = typeof value === 'string' ? value : ''
    body[key] = fieldValue

    const message = validateField(workflow, key, fieldValue)
    if (message) {
      return jsonWithRefreshedCookies(cookieCarrier, { kind: 'error', message }, 400)
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (workflow.auth_type === 'bearer') {
      headers['Authorization'] = `Bearer ${process.env.N8N_MASTER_SECRET}`
    } else if (workflow.auth_type === 'x-n8n-secret') {
      headers['X-N8N-Secret'] = process.env.N8N_MASTER_SECRET!
    }

    const webhookResponse = await fetch(workflow.webhook_url, {
      method: workflow.http_method || 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // Opaque pass-through: the webhook owns the WorkflowOutput contract end
    // to end. We only check that the wire shape matches — we never read or
    // branch on workflow-specific fields inside it.
    const responsePayload = await webhookResponse.json().catch(() => null)

    if (!isWorkflowOutput(responsePayload)) {
      return jsonWithRefreshedCookies(
        cookieCarrier,
        { kind: 'error', message: 'Automation returned an invalid response.' },
        502
      )
    }

    return jsonWithRefreshedCookies(
      cookieCarrier,
      responsePayload,
      responsePayload.kind === 'markdown' ? 200 : 502
    )
  } catch (error) {
    return jsonWithRefreshedCookies(
      cookieCarrier,
      {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Automation failed. Please try again.',
      },
      502
    )
  }
}
