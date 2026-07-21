'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
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

function Prose({ children }: { children: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-a:text-blue-400">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}

function MarkdownOutput({ data }: { data: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-100">Result</h2>
        <CopyButton text={data} />
      </div>
      <Prose>{data}</Prose>
    </div>
  )
}

// n8n holds the connection open for the full duration of the workflow run,
// so a hung automation would otherwise spin the button forever.
const WORKFLOW_TIMEOUT_MS = 10 * 60 * 1000

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
        {workflow.long_description && (
          <div className="mb-6">
            <Prose>{workflow.long_description}</Prose>
          </div>
        )}

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

            const timeoutController = new AbortController()
            const timeoutId = setTimeout(() => timeoutController.abort(), WORKFLOW_TIMEOUT_MS)

            try {
              const response = await fetch('/api/execute-workflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflowId: workflow.id, formData: fields }),
                signal: timeoutController.signal,
              })

              const body = await response.json().catch(() => null)

              const result: WorkflowOutput = isWorkflowOutput(body)
                ? body
                : { kind: 'error', message: 'Automation failed. Please try again.' }

              setFeedback(result)
              setStatus(result.kind === 'markdown' ? 'success' : 'idle')
            } catch (err) {
              const isTimeout = err instanceof DOMException && err.name === 'AbortError'

              setFeedback({
                kind: 'error',
                message: isTimeout
                  ? 'The workflow is taking longer than expected (10 min) — it may still be running in n8n.'
                  : err instanceof Error
                    ? err.message
                    : 'Automation failed. Please try again.',
              })
              setStatus('idle')
            } finally {
              clearTimeout(timeoutId)
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
              ? 'Workflow started…'
              : workflow.action_verb || 'Run Automation'}
          </button>
        </form>

        {feedback && (
          <div className="mt-6">
            {feedback.kind === 'markdown' ? (
              <>
                <p className="mb-3 text-sm font-medium text-emerald-400">Workflow completed!</p>
                <MarkdownOutput data={feedback.data} />
              </>
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
