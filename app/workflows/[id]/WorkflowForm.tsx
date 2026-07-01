'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  WorkflowRow,
  WorkflowOutput,
  isWorkflowOutput,
  validateField,
} from '@/lib/workflows'

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

function MarkdownOutput({ data }: { data: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Result</h2>
        <CopyButton text={data} />
      </div>
      <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono">{data}</pre>
    </div>
  )
}

export default function WorkflowForm({ workflow }: { workflow: WorkflowRow }) {
  const [status, setStatus] = useState<'idle' | 'executing' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<WorkflowOutput | null>(null)

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl">
        <nav className="text-sm text-slate-400 mb-6">
          <Link href="/workflows" className="hover:text-white transition-colors">&lsaquo; Workflows</Link>
        </nav>

        <h1 className="text-2xl font-bold mb-6 capitalize">{workflow.name}</h1>
        <p className="text-slate-400 mb-6">{workflow.description}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-100">
            {error}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault()

            const formData = new FormData(e.currentTarget)
            const fields: Record<string, string> = {}
            for (const [key, value] of formData.entries()) {
              fields[key] = typeof value === 'string' ? value : ''
            }

            setError(null)
            setFeedback(null)
            setStatus('executing')

            try {
              const response = await fetch('/api/execute-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId: workflow.id, formData: fields }),
              })

              const body = await response.json().catch(() => null)

              const result: WorkflowOutput = isWorkflowOutput(body)
                ? body
                : { kind: 'error', message: 'Automation failed. Please try again.' }

              setFeedback(result)
              setStatus(result.kind === 'markdown' ? 'success' : 'idle')
            } catch (err) {
              setFeedback({
                kind: 'error',
                message: err instanceof Error ? err.message : 'Automation failed. Please try again.',
              })
              setStatus('idle')
            }
          }}
          className="flex flex-col gap-4"
        >
          {workflow.inputs.map((input) => (
            <input
              key={input.name}
              name={input.name}
              type={input.type ?? 'text'}
              placeholder={input.placeholder}
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg"
              required
              onBlur={(e) => {
                const message = validateField(workflow, input.name, e.target.value)
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
              : workflow.action_verb || 'Run Automation'}
          </button>
        </form>

        {feedback && (
          <div className="mt-6">
            {feedback.kind === 'markdown' ? (
              <MarkdownOutput data={feedback.data} />
            ) : (
              <div className="p-3 border rounded-lg bg-red-900/50 border-red-700 text-red-100">
                {feedback.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
