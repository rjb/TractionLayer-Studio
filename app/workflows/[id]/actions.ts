'use server'

import { WORKFLOWS, ValidationRule, isValidYouTubeUrlOrId } from '@/lib/workflows'

function getFieldRules(workflowId: string, fieldName: string) {
  const workflow = WORKFLOWS.find((wf) => wf.id === workflowId)
  return workflow?.validations?.[fieldName] ?? []
}

function runFieldValidation(ruleType: string, value: string, rule: ValidationRule) {
  if (ruleType === 'url') {
    new URL(value)
  }

  if (ruleType === 'domain') {
    const domainRule = rule as Extract<ValidationRule, { type: 'domain' }>
    if (domainRule.domain) {
      const url = new URL(value)
      if (url.hostname !== domainRule.domain) {
        throw new Error(rule.message)
      }
    }
  }

  if (ruleType === 'youtube') {
    if (!isValidYouTubeUrlOrId(value)) {
      throw new Error(rule.message)
    }
  }
}

export type StructuredConcept = {
  concept_name: string
  core_speaker_argument: string
  the_universal_human_truth: string
}

export type AutomationResult = {
  success: boolean
  status?: 'success' | 'error'
  message: string
  markdown_output?: string
  structured_concepts?: StructuredConcept[]
}

export async function runAutomation(
  workflowId: string,
  formData: FormData,
  webhookUrl: string
): Promise<AutomationResult> {
  const workflow = WORKFLOWS.find((wf) => wf.id === workflowId)
  if (!workflow) {
    return { success: false, status: 'error', message: 'Workflow not found' }
  }

  const body: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    const fieldValue = typeof value === 'string' ? value : ''
    body[key] = fieldValue

    const rules = getFieldRules(workflowId, key)
    for (const rule of rules) {
      try {
        runFieldValidation(rule.type, fieldValue, rule)
      } catch {
        return { success: false, status: 'error', message: rule.message }
      }
    }
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (workflow.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${process.env.N8N_MASTER_SECRET}`
    } else {
      headers['X-N8N-Secret'] = process.env.N8N_MASTER_SECRET!
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const payload = await response.json().catch(() => null)

    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        status: 'error',
        message: 'Unexpected response from automation service.',
      }
    }

    const record = Array.isArray(payload) ? payload[0] : payload

    if (!record || typeof record !== 'object') {
      return {
        success: false,
        status: 'error',
        message: 'Unexpected response from automation service.',
      }
    }

    const rawStatus = 'status' in record ? String(record.status) : ''
    const normalizedStatus = rawStatus.toLowerCase()
    const isSuccess = ['success', 'succeeded', 'ok'].includes(normalizedStatus)
    const isError = ['error', 'failed'].includes(normalizedStatus)

    const messageField =
      'message' in record && typeof record.message === 'string'
        ? record.message
        : isSuccess
          ? 'Execution completed.'
          : 'Automation finished.'
    const markdown_output =
      'markdown_output' in record && typeof record.markdown_output === 'string'
        ? record.markdown_output
        : undefined
    const structured_concepts =
      'structured_concepts' in record && Array.isArray(record.structured_concepts)
        ? record.structured_concepts
        : undefined

    if (isError) {
      return {
        success: false,
        status: 'error',
        message: messageField,
      }
    }

    return {
      success: isSuccess,
      status: isSuccess ? 'success' : 'error',
      message: messageField,
      markdown_output,
      structured_concepts,
    }
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Automation failed. Please try again.',
    }
  }
}
