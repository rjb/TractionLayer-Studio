import { type NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getActiveWorkflowForClientTag } from '@/lib/workflows-data'
import { validateField, isWorkflowOutput, type WorkflowOutput } from '@/lib/workflows'

function jsonResponse(body: WorkflowOutput, status: number) {
  return NextResponse.json(body, { status })
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return jsonResponse({ kind: 'error', message: 'Unauthorized: please sign in again.' }, 401)
  }

  if (session.user.role !== 'APPROVED') {
    return jsonResponse({ kind: 'error', message: 'Forbidden: your account is not approved.' }, 403)
  }

  let payload: { workflowId?: unknown; formData?: unknown }
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ kind: 'error', message: 'Bad Request: invalid JSON body.' }, 400)
  }

  if (typeof payload.workflowId !== 'string' || typeof payload.formData !== 'object' || payload.formData === null) {
    return jsonResponse({ kind: 'error', message: 'Bad Request: missing workflowId or formData.' }, 400)
  }

  const formData = payload.formData as Record<string, unknown>

  const workflow = await getActiveWorkflowForClientTag(payload.workflowId, session.user.client_tag)

  if (!workflow) {
    return jsonResponse(
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
      return jsonResponse({ kind: 'error', message }, 400)
    }
  }

  try {
    const webhookHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (workflow.auth_type === 'bearer') {
      webhookHeaders['Authorization'] = `Bearer ${process.env.N8N_MASTER_SECRET}`
    } else if (workflow.auth_type === 'x-n8n-secret') {
      webhookHeaders['X-N8N-Secret'] = process.env.N8N_MASTER_SECRET!
    }

    const webhookResponse = await fetch(workflow.webhook_url, {
      method: workflow.http_method || 'POST',
      headers: webhookHeaders,
      body: JSON.stringify(body),
    })

    // Opaque pass-through: the webhook owns the WorkflowOutput contract end
    // to end. We only check that the wire shape matches — we never read or
    // branch on workflow-specific fields inside it.
    const responsePayload = await webhookResponse.json().catch(() => null)

    if (!isWorkflowOutput(responsePayload)) {
      return jsonResponse({ kind: 'error', message: 'Automation returned an invalid response.' }, 502)
    }

    return jsonResponse(responsePayload, responsePayload.kind === 'markdown' ? 200 : 502)
  } catch (error) {
    return jsonResponse(
      {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Automation failed. Please try again.',
      },
      502
    )
  }
}
