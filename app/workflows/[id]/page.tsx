'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { WORKFLOWS, ValidationRule, isValidYouTubeUrlOrId } from '@/lib/workflows'
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
      const { domain } = rule as Extract<ValidationRule, { type: 'domain' }>
      try {
        const url = new URL(value)
        if (url.hostname !== domain) {
          return rule.message
        }
      } catch {
        return rule.message
      }
    }

    if ((rule as ValidationRule).type === 'youtube') {
      if (!isValidYouTubeUrlOrId(value)) {
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

function CopyButton({ text }: { text?: string }) {
  const [copied, setCopied] = useState(false)

  if (!text) return null

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Ignore clipboard errors
        }
      }}
      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy to Clipboard'}
    </button>
  )
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
          <div className="mt-6">
            {feedback.status === 'success' &&
            Array.isArray(feedback.structured_concepts) &&
            feedback.structured_concepts.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-100">Concepts</h2>
                  <CopyButton text={feedback.markdown_output} />
                </div>
                <div className="grid grid-cols-1 gap-5">
                  {feedback.structured_concepts.map((concept, index) => (
                    <div
                      key={index}
                      className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm"
                    >
                      <h3 className="text-base font-bold text-slate-100 mb-2">
                        {concept.concept_name}
                      </h3>
                      <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        {concept.core_speaker_argument}
                      </p>
                      <blockquote className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 italic text-indigo-100 text-sm leading-relaxed">
                        {concept.the_universal_human_truth}
                      </blockquote>
                    </div>
                  ))}
                </div>
              </>
            ) : feedback.status === 'success' && feedback.markdown_output ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-100">Result</h2>
                  <CopyButton text={feedback.markdown_output} />
                </div>
                <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono">
                  {feedback.markdown_output}
                </pre>
              </div>
            ) : (
              <div
                className={`p-3 border rounded-lg ${getFeedbackStyle(
                  feedback.status
                )}`}
              >
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
