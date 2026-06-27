export type WorkflowInput = {
  name: string
  placeholder: string
}

export type ValidationRule =
  | { type: 'url'; message: string }
  | { type: 'domain'; domain: string; message: string }
  | { type: 'youtube'; message: string }

export type Workflow = {
  id: string
  name: string
  desc: string
  webhookUrl: string
  inputs: WorkflowInput[]
  actionVerb: string
  authType?: 'x-n8n-secret' | 'bearer'
  validations?: Record<string, ValidationRule[]>
}

export function isValidYouTubeUrlOrId(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const idPattern = /^[A-Za-z0-9_-]{11}$/
  if (idPattern.test(trimmed)) return true

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split(/[/?#]/)[0]
      return idPattern.test(id)
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = url.searchParams.get('v')
      if (id && idPattern.test(id)) return true

      const embedMatch = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})/)
      if (embedMatch) return true
    }
  } catch {
    return false
  }

  return false
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'substack-to-blog',
    name: 'Substack to Blog',
    desc: 'Converts a Substack article into SEO-optimized blog post and publishes to the production site (kristybanks.com/blog) and the staging site (kristybanks-staging.onrender.com/blog)',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/d1254f5d-332f-404a-bd57-38edaea4389f',
    inputs: [
      { name: 'substackUrl', placeholder: 'Paste Substack article URL here...' },
    ],
    actionVerb: 'Publish to Blog',
    validations: {
      substackUrl: [
        { type: 'url', message: 'Please enter a valid URL.' },
        {
          type: 'domain',
          domain: 'kristybanks.substack.com',
          message: 'URL must be from kristybanks.substack.com.',
        },
      ],
    },
  },
  {
    id: 'youtube-insight-miner',
    name: 'YouTube Insight Miner',
    desc: 'Extract actionable talking points from YouTube videos tailored to your audience.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/e5e407d6-b98d-43af-971e-02cf9169d6dc',
    inputs: [
      {
        name: 'url',
        placeholder: 'Paste YouTube video URL or 11-character ID here...',
      },
    ],
    actionVerb: 'Mine Insights',
    authType: 'x-n8n-secret',
    validations: {
      url: [
        {
          type: 'youtube',
          message: 'Please enter a valid YouTube URL or 11-character video ID.',
        },
      ],
    },
  },
]
