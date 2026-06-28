import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Pending – TractionLayer Studio',
}

export default function AccountPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <svg
            className="h-6 w-6 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Access Pending</h1>
        <p className="text-slate-400 leading-relaxed">
          Your account is awaiting administrator approval. You will be able to
          access the studio once an administrator has signed off on your
          request.
        </p>
      </div>
    </div>
  )
}
