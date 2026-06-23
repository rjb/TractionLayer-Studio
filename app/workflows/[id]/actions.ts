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

export async function runAutomation(
  workflowId: string,
  formData: FormData,
  webhookUrl: string
) {
  const workflow = WORKFLOWS.find((wf) => wf.id === workflowId)
  if (!workflow) {
    return { success: false, message: 'Workflow not found' }
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
        return { success: false, message: rule.message }
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

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    return { success: true, message: '' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Automation failed. Please try again.',
    }
  }
}
