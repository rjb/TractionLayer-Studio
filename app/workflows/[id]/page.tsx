'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { WORKFLOWS, ValidationRule } from '@/lib/workflows'
import { runAutomation, AutomationResult } from './actions'

function validateField(workflowId: string, fieldName: string, value: string): string {
  const workflow = WORKFLOWS.find((wf) => wf.id === workflowId)
  const rules = workflow?.validations?.[fieldName]
  if (!rules) return ''

  for (const rule of rules) {
    if ((rule as ValidationRule).type === 'url') {
      try {
        new URL(value)
      } catch {
        return rule.message
      }
    }

    if ((rule as ValidationRule).type === 'domain') {
      const domain = (rule as any).domain
      try {
        const url = new URL(value)
        if (url.hostname !== domain) {
          return rule.message
        }
      } catch {
        return rule.message
      }
    }
  }

  return ''
}

function getFeedbackStyle(status?: 'success' | 'error') {
  if (status === 'success') {
    return 'bg-green-900/50 border-green-700 text-green-100'
  }

  return 'bg-red-900/50 border-red-700 text-red-100'
}

export default function WorkflowPage() {
  const { id } = useParams()
  const [status, setStatus] = useState<'idle' | 'executing' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<AutomationResult | null>(null)

  const workflow = WORKFLOWS.find((wf) => wf.id === id)

  if (!workflow) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl">
          <nav className="text-sm text-slate-400 mb-6">
            <Link href="/workflows" className="hover:text-white transition-colors">&lsaquo; Workflows</Link>
          </nav>

          <h1 className="text-2xl font-bold mb-6">Workflow not found</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl">
        <nav className="text-sm text-slate-400 mb-6">
          <Link href="/workflows" className="hover:text-white transition-colors">&lsaquo; Workflows</Link>
        </nav>

        <h1 className="text-2xl font-bold mb-6 capitalize">{workflow.name}</h1>
        <p className="text-slate-400 mb-6">{workflow.desc}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-100">
            {error}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault()

            const formData = new FormData(e.currentTarget)

            setError(null)
            setFeedback(null)
            setStatus('executing')

            const result = await runAutomation(String(id), formData, workflow.webhookUrl)

            setFeedback(result)

            if (result.success) {
              setStatus('success')
            } else {
              setStatus('idle')
            }
          }}
          className="flex flex-col gap-4"
        >
          {workflow.inputs.map((input) => (
            <input
              key={input.name}
              name={input.name}
              placeholder={input.placeholder}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg"
              required
              onBlur={(e) => {
                const message = validateField(String(id), input.name, e.target.value)
                if (message) setError(message)
              }}
            />
          ))}
          <button
            type="submit"
            className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={status === 'executing'}
          >
            {status === 'executing'
              ? 'Processing...'
              : workflow.actionVerb || 'Run Automation'}
          </button>
        </form>

        {feedback && (
          <div className={`mt-4 p-3 border rounded-lg ${getFeedbackStyle(feedback.status)}`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  )
}
