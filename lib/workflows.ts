export type WorkflowInput = {
  name: string
  placeholder: string
}

export type ValidationRule =
  | { type: 'url'; message: string }
  | { type: 'domain'; domain: string; message: string }

export type Workflow = {
  id: string
  name: string
  desc: string
  webhookUrl: string
  inputs: WorkflowInput[]
  actionVerb: string
  validations?: Record<string, ValidationRule[]>
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'substack-to-blog',
    name: 'Substack to Blog',
    desc: 'Converts Substack articles into SEO-optimized blog posts and publishes them to the production site (kristybanks.com/blog) and the staging site (kristybanks-staging.onrender.com/blog)',
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
    id: 'meeting-summary',
    name: 'Meeting Summarizer',
    desc: 'Transcribes audio to meeting minutes.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/meeting-summary',
    inputs: [
      { name: 'recordingUrl', placeholder: 'Paste meeting recording URL...' },
      { name: 'attendees', placeholder: 'Comma-separated attendee names' },
      { name: 'topics', placeholder: 'Key topics to highlight' },
    ],
    actionVerb: 'Summarize Meeting',
  },
  {
    id: 'content-distributor',
    name: 'Content Distributor',
    desc: 'Pushes content to multiple social channels.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/content-distributor',
    inputs: [
      { name: 'contentUrl', placeholder: 'Paste content URL to distribute...' },
    ],
    actionVerb: 'Distribute Content',
    validations: {
      contentUrl: [{ type: 'url', message: 'Please enter a valid URL.' }],
    },
  },
  {
    id: 'substack-to-blog-NEW',
    name: 'Substack to Blog NEW',
    desc: 'Converts Substack drafts to SEO blog posts.',
    webhookUrl: 'https://n8n.tractionlayer.com/webhook/substack-to-blog-new',
    inputs: [
      { name: 'substackUrl', placeholder: 'Paste Substack draft URL...' },
      { name: 'tone', placeholder: 'e.g. Professional, casual, witty' },
    ],
    actionVerb: 'Stage Markdown',
  },
]
