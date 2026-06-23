'use server'

import { WORKFLOWS } from '@/lib/workflows'

function getFieldRules(workflowId: string, fieldName: string) {
  const workflow = WORKFLOWS.find((wf) => wf.id === workflowId)
  return workflow?.validations?.[fieldName] ?? []
}

function runFieldValidation(ruleType: string, value: string, rule: any) {
  if (ruleType === 'url') {
    new URL(value)
  }

  if (ruleType === 'domain' && rule.domain) {
    const url = new URL(value)
    if (url.hostname !== rule.domain) {
      throw new Error(rule.message)
    }
  }
}

export type AutomationResult = {
  success: boolean
  status?: 'success' | 'error'
  message: string
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
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Secret': process.env.N8N_MASTER_SECRET!,
      },
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

    const statusField = 'status' in record ? String(record.status) : ''
    const messageField = 'message' in record ? String(record.message) : 'Automation finished.'

    if (statusField === 'error') {
      return {
        success: false,
        status: 'error',
        message: messageField,
      }
    }

    return {
      success: statusField === 'success',
      status: statusField === 'success' ? 'success' : 'error',
      message: messageField,
    }
  } catch (error) {
    return {
      success: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Automation failed. Please try again.',
    }
  }
}
